/**
 * RunPod Serverless Provider
 *
 * Uses existing RunPod Serverless endpoint for image generation.
 * Requires a pre-created endpoint with ComfyUI + Flux worker.
 *
 * Setup:
 * 1. Go to https://runpod.io/console/serverless
 * 2. Create endpoint with template: runpod/worker-comfyui:*-flux1-dev
 * 3. Set RUNPOD_ENDPOINT_ID in .env
 *
 * Cost: ~$0.003/image (8x cheaper than Replicate flux-dev)
 */

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

// Directory to store generated images
const IMAGES_DIR = path.join(process.cwd(), 'public', 'images');
const API_BASE_URL = process.env.API_BASE_URL!;

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

const RUNPOD_AI_API = 'https://api.runpod.ai/v2';

export interface RunPodGenerateOptions {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  steps?: number;
  cfg?: number;
}

export interface RunPodBatchRequest {
  id: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
}

export interface RunPodBatchResult {
  id: string;
  imageUrl: string;
  success: boolean;
  error?: string;
}

interface RunSyncResponse {
  id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  output?: {
    message?: string;
    images?: Array<{ image: string; seed?: number }>;
    status?: string;
  };
  error?: string;
}

interface RunAsyncResponse {
  id: string;
  status: string;
}

interface StatusResponse {
  id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  output?: {
    message?: string;
    images?: Array<{ image: string; seed?: number }>;
  };
  error?: string;
}

export interface RunPodKontextOptions {
  prompt: string;
  /** Optional: Base64 image data for image-to-image editing (not yet implemented) */
  referenceImage?: string;
  width?: number;
  height?: number;
  seed?: number;
  /** CFG scale (default: 1.0 for FLUX) */
  guidance?: number;
  /** Inference steps (default: 20) */
  steps?: number;
}

export class RunPodProvider {
  private apiKey: string;
  private endpointId: string;
  private kontextEndpointId: string;

  constructor(apiKey?: string, endpointId?: string, kontextEndpointId?: string) {
    this.apiKey = apiKey || process.env.RUNPOD_API_KEY || '';
    this.endpointId = endpointId || process.env.RUNPOD_ENDPOINT_ID || '';
    this.kontextEndpointId = kontextEndpointId || process.env.RUNPOD_KONTEXT_ENDPOINT_ID || '';

    if (!this.apiKey) {
      console.warn('[RunPod] No API key. Set RUNPOD_API_KEY in .env');
    }
    if (!this.endpointId) {
      console.warn('[RunPod] No endpoint ID. Set RUNPOD_ENDPOINT_ID in .env');
      console.warn('[RunPod] Create endpoint at: https://runpod.io/console/serverless');
    }
  }

  /**
   * Check if Kontext endpoint is configured
   */
  isKontextConfigured(): boolean {
    return !!(this.apiKey && this.kontextEndpointId);
  }

  /**
   * Check if RunPod is properly configured
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.endpointId);
  }

  /**
   * Run job synchronously (waits for completion)
   */
  private async runSync(input: unknown, timeoutMs = 120000, endpointId?: string): Promise<RunSyncResponse> {
    const endpoint = endpointId || this.endpointId;
    const url = `${RUNPOD_AI_API}/${endpoint}/runsync`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`RunPod API error (${response.status}): ${errorText}`);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
      }
      throw error;
    }
  }

  /**
   * Run job asynchronously
   */
  private async runAsync(input: unknown, endpointId?: string): Promise<string> {
    const endpoint = endpointId || this.endpointId;
    const url = `${RUNPOD_AI_API}/${endpoint}/run`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RunPod API error (${response.status}): ${errorText}`);
    }

    const data: RunAsyncResponse = await response.json();
    return data.id;
  }

  /**
   * Check job status
   */
  private async getStatus(jobId: string, endpointId?: string): Promise<StatusResponse> {
    const endpoint = endpointId || this.endpointId;
    const url = `${RUNPOD_AI_API}/${endpoint}/status/${jobId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RunPod status error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  /**
   * Wait for job completion with polling
   */
  private async waitForJob(jobId: string, timeoutMs = 180000, endpointId?: string): Promise<StatusResponse> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getStatus(jobId, endpointId);

      if (status.status === 'COMPLETED') {
        return status;
      }

      if (status.status === 'FAILED' || status.status === 'CANCELLED') {
        throw new Error(`Job ${status.status}: ${status.error || 'Unknown error'}`);
      }

      // Still IN_QUEUE or IN_PROGRESS
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Job timed out after ${timeoutMs / 1000}s`);
  }

  /**
   * Build ComfyUI workflow for FLUX text-to-image generation
   * Uses CheckpointLoaderSimple format for flux1-dev-fp8.safetensors
   * Based on: https://comfyui-wiki.com/en/tutorial/advanced/image/flux/flux-1-dev-t2i
   */
  private buildInput(options: RunPodGenerateOptions): unknown {
    const width = options.width || 1024;
    const height = options.height || 1024;
    const seed = options.seed ?? Math.floor(Math.random() * 2147483647);
    const steps = options.steps || 20;
    const cfg = options.cfg || 1.0; // FLUX uses low CFG (1.0) with guidance node

    // ComfyUI workflow using CheckpointLoaderSimple (all-in-one checkpoint)
    // This format works with flux1-dev-fp8.safetensors pre-installed on RunPod
    return {
      workflow: {
        // Load checkpoint (model + clip + vae all in one)
        "4": {
          "inputs": {
            "ckpt_name": "flux1-dev-fp8.safetensors"
          },
          "class_type": "CheckpointLoaderSimple",
          "_meta": { "title": "Load Checkpoint" }
        },
        // Positive prompt encoding
        "6": {
          "inputs": {
            "text": options.prompt,
            "clip": ["4", 1]
          },
          "class_type": "CLIPTextEncode",
          "_meta": { "title": "CLIP Text Encode (Positive Prompt)" }
        },
        // Negative prompt (empty for FLUX)
        "7": {
          "inputs": {
            "text": options.negativePrompt || "",
            "clip": ["4", 1]
          },
          "class_type": "CLIPTextEncode",
          "_meta": { "title": "CLIP Text Encode (Negative Prompt)" }
        },
        // Empty latent image
        "5": {
          "inputs": {
            "width": width,
            "height": height,
            "batch_size": 1
          },
          "class_type": "EmptyLatentImage",
          "_meta": { "title": "Empty Latent Image" }
        },
        // KSampler
        "3": {
          "inputs": {
            "seed": seed,
            "steps": steps,
            "cfg": cfg,
            "sampler_name": "euler",
            "scheduler": "simple",
            "denoise": 1,
            "model": ["4", 0],
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["5", 0]
          },
          "class_type": "KSampler",
          "_meta": { "title": "KSampler" }
        },
        // VAE Decode
        "8": {
          "inputs": {
            "samples": ["3", 0],
            "vae": ["4", 2]
          },
          "class_type": "VAEDecode",
          "_meta": { "title": "VAE Decode" }
        },
        // Save Image
        "9": {
          "inputs": {
            "filename_prefix": "ComfyUI",
            "images": ["8", 0]
          },
          "class_type": "SaveImage",
          "_meta": { "title": "Save Image" }
        }
      }
    };
  }

  /**
   * Build ComfyUI workflow for FLUX Kontext text-to-image generation
   *
   * Uses UNETLoader format for flux1-kontext-dev-fp8.safetensors from Network Volume
   * Note: Kontext model supports image editing, but for now we use it for text-to-image
   * with the same workflow structure as regular FLUX
   */
  private buildKontextInput(options: RunPodKontextOptions): unknown {
    const width = options.width || 1024;
    const height = options.height || 1024;
    const seed = options.seed ?? Math.floor(Math.random() * 2147483647);
    const steps = options.steps || 20;
    const cfg = options.guidance || 1.0; // FLUX Kontext uses low CFG

    // ComfyUI workflow using UNETLoader for Kontext model from Network Volume
    return {
      workflow: {
        // Load UNET (Kontext model from Network Volume)
        "1": {
          "class_type": "UNETLoader",
          "inputs": {
            "unet_name": "flux1-kontext-dev-fp8.safetensors",
            "weight_dtype": "fp8_e4m3fn"
          }
        },
        // Load CLIP models
        "2": {
          "class_type": "DualCLIPLoader",
          "inputs": {
            "clip_name1": "clip_l.safetensors",
            "clip_name2": "t5xxl_fp8_e4m3fn.safetensors",
            "type": "flux"
          }
        },
        // Load VAE
        "3": {
          "class_type": "VAELoader",
          "inputs": {
            "vae_name": "ae.safetensors"
          }
        },
        // Encode prompt
        "4": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": options.prompt,
            "clip": ["2", 0]
          }
        },
        // Empty latent image
        "5": {
          "class_type": "EmptySD3LatentImage",
          "inputs": {
            "width": width,
            "height": height,
            "batch_size": 1
          }
        },
        // KSampler
        "6": {
          "class_type": "KSampler",
          "inputs": {
            "model": ["1", 0],
            "positive": ["4", 0],
            "negative": ["4", 0],  // Use same as positive (no negative for FLUX)
            "latent_image": ["5", 0],
            "seed": seed,
            "steps": steps,
            "cfg": cfg,
            "sampler_name": "euler",
            "scheduler": "simple",
            "denoise": 1.0
          }
        },
        // VAE Decode
        "7": {
          "class_type": "VAEDecode",
          "inputs": {
            "samples": ["6", 0],
            "vae": ["3", 0]
          }
        },
        // Save Image
        "8": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["7", 0],
            "filename_prefix": "kontext"
          }
        }
      }
    };
  }

  /**
   * Generate image using FLUX Kontext for character consistency
   */
  async generateKontext(options: RunPodKontextOptions): Promise<string> {
    if (!this.isKontextConfigured()) {
      throw new Error('RunPod Kontext not configured. Set RUNPOD_KONTEXT_ENDPOINT_ID in .env');
    }

    console.log(`[RunPod Kontext] Generating: "${options.prompt.substring(0, 50)}..."`);

    const input = this.buildKontextInput(options);

    // Always use async with polling for reliable results
    const jobId = await this.runAsync(input, this.kontextEndpointId);
    console.log(`[RunPod Kontext] Job started: ${jobId}`);

    const result = await this.waitForJob(jobId, 300000, this.kontextEndpointId);

    if (result.status === 'FAILED') {
      throw new Error(`Kontext generation failed: ${result.error || 'Unknown error'}`);
    }

    const imageData = this.extractImage(result);
    const localUrl = await this.saveImageLocally(imageData, options.prompt);

    console.log(`[RunPod Kontext] ✓ Saved: ${localUrl}`);
    return localUrl;
  }

  /**
   * Download image from base64 or URL and save locally
   */
  private async saveImageLocally(imageData: string, prompt: string): Promise<string> {
    const hash = createHash('md5').update(prompt + Date.now()).digest('hex').substring(0, 12);
    const filename = `${hash}.webp`;
    const filepath = path.join(IMAGES_DIR, filename);

    if (imageData.startsWith('http')) {
      // Download from URL
      const response = await fetch(imageData);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(filepath, Buffer.from(buffer));
    } else if (imageData.startsWith('data:')) {
      // Data URL
      const base64 = imageData.split(',')[1];
      const buffer = Buffer.from(base64, 'base64');
      fs.writeFileSync(filepath, buffer);
    } else {
      // Raw base64
      const buffer = Buffer.from(imageData, 'base64');
      fs.writeFileSync(filepath, buffer);
    }

    return `${API_BASE_URL}/images/${filename}`;
  }

  /**
   * Generate a single image
   */
  async generate(options: RunPodGenerateOptions): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('RunPod not configured. Set RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID in .env');
    }

    console.log(`[RunPod] Generating: "${options.prompt.substring(0, 50)}..."`);

    const input = this.buildInput(options);

    try {
      // Try sync first (faster if worker is warm)
      const response = await this.runSync(input, 120000);

      if (response.status === 'FAILED') {
        throw new Error(`Generation failed: ${response.error || 'Unknown error'}`);
      }

      // Extract image from response
      const imageData = this.extractImage(response);
      const localUrl = await this.saveImageLocally(imageData, options.prompt);

      console.log(`[RunPod] ✓ Saved: ${localUrl}`);
      return localUrl;
    } catch (error) {
      // If sync times out, try async with polling
      if (error instanceof Error && error.message.includes('timed out')) {
        console.log('[RunPod] Sync timed out, trying async...');
        return this.generateAsync(options);
      }
      throw error;
    }
  }

  /**
   * Generate image using async endpoint with polling
   */
  private async generateAsync(options: RunPodGenerateOptions): Promise<string> {
    const input = this.buildInput(options);
    const jobId = await this.runAsync(input);

    console.log(`[RunPod] Job started: ${jobId}`);

    const result = await this.waitForJob(jobId, 180000);
    const imageData = this.extractImage(result);
    const localUrl = await this.saveImageLocally(imageData, options.prompt);

    console.log(`[RunPod] ✓ Saved: ${localUrl}`);
    return localUrl;
  }

  /**
   * Extract image data from response
   */
  private extractImage(response: RunSyncResponse | StatusResponse): string {
    // Log the response structure for debugging (truncate long base64)
    const logOutput = JSON.stringify(response, (key, val) =>
      key === 'data' && typeof val === 'string' && val.length > 100
        ? `${val.substring(0, 50)}... (${Math.round(val.length / 1024)}KB base64)`
        : val
    , 2).substring(0, 1000);
    console.log('[RunPod] Response structure:', logOutput);

    // Check for images array in output (ComfyUI worker format)
    if (response.output && typeof response.output === 'object') {
      const output = response.output as Record<string, unknown>;

      // ComfyUI worker format: output.images[0].data (base64)
      if (Array.isArray(output.images) && output.images.length > 0) {
        const firstImage = output.images[0];
        if (typeof firstImage === 'string') {
          return firstImage;
        }
        if (firstImage && typeof firstImage === 'object') {
          const imgObj = firstImage as Record<string, unknown>;
          // ComfyUI worker returns { data: "base64..." }
          if (typeof imgObj.data === 'string') return imgObj.data;
          if (typeof imgObj.image === 'string') return imgObj.image;
          if (typeof imgObj.url === 'string') return imgObj.url;
        }
      }

      // RunPod Hub format: image_url
      if (typeof output.image_url === 'string') {
        return output.image_url;
      }

      // Check for direct image string
      if (typeof output.image === 'string') {
        return output.image;
      }

      // Check for url field
      if (typeof output.url === 'string') {
        return output.url;
      }

      // Check for message field (some workers return base64 here)
      if (typeof output.message === 'string' && output.message.length > 100) {
        return output.message;
      }
    }

    // Legacy format: response.output.images[0].image
    if (response.output?.images?.length) {
      const firstImage = response.output.images[0];
      if (typeof firstImage === 'string') {
        return firstImage;
      }
      if (firstImage && typeof firstImage.image === 'string') {
        return firstImage.image;
      }
    }

    // Log full output for debugging
    console.error('[RunPod] Unable to extract image. Full output:', JSON.stringify(response.output, null, 2));
    throw new Error('No image in response. Check logs for output structure.');
  }

  /**
   * Generate multiple images (parallel with concurrency limit)
   */
  async generateBatch(
    requests: RunPodBatchRequest[],
    onProgress?: (current: number, total: number, status: string) => void
  ): Promise<RunPodBatchResult[]> {
    if (!this.isConfigured()) {
      throw new Error('RunPod not configured. Set RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID in .env');
    }

    console.log(`[RunPod] Batch: ${requests.length} images`);
    const results: RunPodBatchResult[] = [];
    const concurrency = 3; // Process 3 at a time

    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      const batchNum = Math.floor(i / concurrency) + 1;
      const totalBatches = Math.ceil(requests.length / concurrency);

      onProgress?.(i, requests.length, `Batch ${batchNum}/${totalBatches}: generating ${batch.length} images...`);

      const batchPromises = batch.map(async (req) => {
        try {
          const imageUrl = await this.generate({
            prompt: req.prompt,
            negativePrompt: req.negativePrompt,
            width: req.width,
            height: req.height,
            seed: req.seed,
          });
          return {
            id: req.id,
            imageUrl,
            success: true,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[RunPod] Failed ${req.id}: ${errorMessage}`);
          return {
            id: req.id,
            imageUrl: '',
            success: false,
            error: errorMessage,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      const completed = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      console.log(`[RunPod] Progress: ${completed} success, ${failed} failed, ${requests.length - results.length} remaining`);
    }

    onProgress?.(requests.length, requests.length, 'Complete!');

    const totalGenerated = results.filter(r => r.success).length;
    const totalFailed = results.filter(r => !r.success).length;
    console.log(`[RunPod] Batch complete: ${totalGenerated} success, ${totalFailed} failed`);

    return results;
  }

  /**
   * Get configuration status info
   */
  getConfigStatus(): { configured: boolean; endpointId: string | null } {
    return {
      configured: this.isConfigured(),
      endpointId: this.endpointId || null,
    };
  }
}

// Export singleton instance
export const runpodProvider = new RunPodProvider();
