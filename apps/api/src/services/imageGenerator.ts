/**
 * Image Generation Service
 *
 * Generates comic panel images using Replicate's Flux models.
 * Supports flux-schnell (fast/cheap), flux-dev (balanced), flux-pro (best quality).
 * Images are saved locally to avoid Replicate URL expiration.
 */

import Replicate from 'replicate';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { RunPodProvider } from './runpodProvider';

dotenv.config();

// Directory to store generated images
const IMAGES_DIR = path.join(process.cwd(), 'public', 'images');

// API base URL for serving images
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

export type ImageProvider = 'flux-schnell' | 'flux-dev' | 'flux-pro' | 'runpod-flux';
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3';

export interface GenerateImageRequest {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: AspectRatio;
  seed?: number;
  provider?: ImageProvider;
}

export interface GenerateImageResponse {
  imageUrl: string;
  provider: ImageProvider;
  aspectRatio: AspectRatio;
  seed?: number;
}

export interface GenerateBatchRequest {
  images: Array<{
    id: string;
    prompt: string;
    negativePrompt?: string;
    aspectRatio?: AspectRatio;
    seed?: number;
  }>;
  provider?: ImageProvider;
}

export interface GenerateBatchResponse {
  results: Array<{
    id: string;
    imageUrl: string;
    success: boolean;
    error?: string;
  }>;
  provider: ImageProvider;
  totalGenerated: number;
  totalFailed: number;
}

// Replicate providers (excludes runpod-flux which uses RunPod API)
type ReplicateProvider = 'flux-schnell' | 'flux-dev' | 'flux-pro';

// Model IDs for different Flux versions (with version hashes)
const FLUX_MODELS: Record<ReplicateProvider, `${string}/${string}:${string}`> = {
  'flux-schnell': 'black-forest-labs/flux-schnell:c846a69991daf4c0e5d016514849d14ee5b2e6846ce6b9d6f21369e564cfe51e',
  'flux-dev': 'black-forest-labs/flux-dev:6e4a938f85952bdabcc15aa329178c4d681c52bf25a0342403287dc26944661d',
  'flux-pro': 'black-forest-labs/flux-2-pro:285631b5656a1839331cd9af0d82da820e2075db12046d1d061c681b2f206bc6',
};

export class ImageGenerator {
  private replicate: Replicate;
  private runpod: RunPodProvider;
  private defaultProvider: ImageProvider;

  constructor() {
    this.replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN || '',
    });
    this.runpod = new RunPodProvider();

    // Get default provider from env or use flux-dev
    const envProvider = process.env.IMAGE_PROVIDER as ImageProvider;
    this.defaultProvider = ['flux-schnell', 'flux-dev', 'flux-pro', 'runpod-flux'].includes(envProvider)
      ? envProvider
      : 'flux-dev';
  }

  /**
   * Generate a single image
   */
  /**
   * Convert aspect ratio to width/height
   */
  private aspectRatioToDimensions(aspectRatio: AspectRatio): { width: number; height: number } {
    const dimensions: Record<AspectRatio, { width: number; height: number }> = {
      '1:1': { width: 1024, height: 1024 },
      '16:9': { width: 1344, height: 768 },
      '9:16': { width: 768, height: 1344 },
      '4:3': { width: 1152, height: 896 },
      '3:4': { width: 896, height: 1152 },
      '3:2': { width: 1216, height: 832 },
      '2:3': { width: 832, height: 1216 },
    };
    return dimensions[aspectRatio] || dimensions['1:1'];
  }

  async generate(request: GenerateImageRequest): Promise<GenerateImageResponse> {
    const provider = request.provider || this.defaultProvider;
    const aspectRatio = request.aspectRatio || '1:1';

    console.log(`[ImageGenerator] Generating image with ${provider}, aspect: ${aspectRatio}`);
    console.log(`[ImageGenerator] Prompt: "${request.prompt.substring(0, 100)}..."`);

    // RunPod provider - use separate logic
    if (provider === 'runpod-flux') {
      return this.generateWithRunPod(request, aspectRatio);
    }

    const input: Record<string, unknown> = {
      prompt: request.prompt,
      aspect_ratio: aspectRatio,
    };

    // Add negative prompt if provided (not all models support it)
    if (request.negativePrompt && provider !== 'flux-schnell') {
      input.negative_prompt = request.negativePrompt;
    }

    // Add seed for reproducibility
    if (request.seed !== undefined) {
      input.seed = request.seed;
    }

    // Model-specific settings
    if (provider === 'flux-schnell') {
      input.num_outputs = 1;
      input.output_format = 'webp';
      input.output_quality = 90;
    } else if (provider === 'flux-dev') {
      input.num_outputs = 1;
      input.guidance = 3.5;
      input.num_inference_steps = 28;
      input.output_format = 'webp';
      input.output_quality = 90;
    } else if (provider === 'flux-pro') {
      input.safety_tolerance = 2;
      input.output_format = 'webp';
    }

    try {
      const output = await this.replicate.run(FLUX_MODELS[provider as keyof typeof FLUX_MODELS], { input });

      // Handle different output formats
      let replicateUrl: string;
      if (typeof output === 'string') {
        replicateUrl = output;
      } else if (Array.isArray(output) && output.length > 0) {
        replicateUrl = output[0];
      } else if (output && typeof output === 'object' && 'url' in output) {
        replicateUrl = (output as { url: string }).url;
      } else {
        throw new Error('Unexpected output format from Replicate');
      }

      // Download and save image locally to avoid URL expiration
      const localUrl = await this.saveImageLocally(replicateUrl, request.prompt);

      console.log(`[ImageGenerator] ✓ Generated & saved: ${localUrl}`);

      return {
        imageUrl: localUrl,
        provider,
        aspectRatio,
        seed: request.seed,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ImageGenerator] ✗ Failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Generate image using RunPod Serverless
   */
  private async generateWithRunPod(
    request: GenerateImageRequest,
    aspectRatio: AspectRatio
  ): Promise<GenerateImageResponse> {
    const { width, height } = this.aspectRatioToDimensions(aspectRatio);

    const imageUrl = await this.runpod.generate({
      prompt: request.prompt,
      negativePrompt: request.negativePrompt,
      width,
      height,
      seed: request.seed,
    });

    return {
      imageUrl,
      provider: 'runpod-flux',
      aspectRatio,
      seed: request.seed,
    };
  }

  /**
   * Download image from URL and save locally
   */
  private async saveImageLocally(url: string, prompt: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();

    // Generate unique filename from prompt hash + timestamp
    const hash = createHash('md5').update(prompt + Date.now()).digest('hex').substring(0, 12);
    const ext = url.includes('.webp') ? 'webp' : 'png';
    const filename = `${hash}.${ext}`;
    const filepath = path.join(IMAGES_DIR, filename);

    fs.writeFileSync(filepath, Buffer.from(buffer));

    // Return full URL that can be served by the API
    return `${API_BASE_URL}/images/${filename}`;
  }

  /**
   * Extract retry_after from rate limit error message
   */
  private extractRetryAfter(errorMessage: string): number {
    const match = errorMessage.match(/retry_after.*?(\d+)/i) || errorMessage.match(/resets in ~(\d+)s/);
    return match ? parseInt(match[1], 10) + 2 : 15; // Add 2s buffer, default 15s
  }

  /**
   * Generate a single image with retry logic (respects rate limits)
   */
  private async generateWithRetry(
    img: GenerateBatchRequest['images'][0],
    provider: ImageProvider,
    maxRetries = 5
  ): Promise<GenerateBatchResponse['results'][0]> {
    let lastError = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.generate({
          prompt: img.prompt,
          negativePrompt: img.negativePrompt,
          aspectRatio: img.aspectRatio,
          seed: img.seed,
          provider,
        });

        return {
          id: img.id,
          imageUrl: result.imageUrl,
          success: true,
        };
      } catch (error: unknown) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        const isRateLimit = lastError.includes('429') || lastError.includes('Too Many Requests');

        console.log(`[ImageGenerator] Attempt ${attempt}/${maxRetries} failed for ${img.id}: ${isRateLimit ? 'Rate limited' : lastError.substring(0, 80)}`);

        if (attempt < maxRetries) {
          // Use retry_after from API or exponential backoff
          const delay = isRateLimit
            ? this.extractRetryAfter(lastError) * 1000
            : Math.pow(2, attempt) * 1000;

          console.log(`[ImageGenerator] Waiting ${delay/1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      id: img.id,
      imageUrl: '',
      success: false,
      error: lastError,
    };
  }

  /**
   * Generate multiple images (PARALLEL for RunPod, SEQUENTIAL for Replicate)
   */
  async generateBatch(
    request: GenerateBatchRequest,
    onProgress?: (current: number, total: number, status: string) => void
  ): Promise<GenerateBatchResponse> {
    const provider = request.provider || this.defaultProvider;

    // RunPod: use parallel batch generation with endpoint lifecycle
    if (provider === 'runpod-flux') {
      return this.generateBatchWithRunPod(request, onProgress);
    }

    console.log(`[ImageGenerator] Batch: ${request.images.length} images with ${provider} (sequential mode)`);

    const results: GenerateBatchResponse['results'] = [];

    // Process images ONE BY ONE to respect rate limits (6 req/min = 10s between requests)
    for (let i = 0; i < request.images.length; i++) {
      const img = request.images[i];
      console.log(`[ImageGenerator] Processing ${i + 1}/${request.images.length}: ${img.id}`);
      onProgress?.(i, request.images.length, `Generating image ${i + 1}/${request.images.length}...`);

      const result = await this.generateWithRetry(img, provider);
      results.push(result);

      // Wait 12 seconds between successful requests (6 req/min limit)
      if (i < request.images.length - 1 && result.success) {
        console.log(`[ImageGenerator] Waiting 12s for rate limit...`);
        await new Promise(resolve => setTimeout(resolve, 12000));
      }
    }

    const totalGenerated = results.filter(r => r.success).length;
    const totalFailed = results.filter(r => !r.success).length;

    console.log(`[ImageGenerator] Batch complete: ${totalGenerated} success, ${totalFailed} failed`);

    return {
      results,
      provider,
      totalGenerated,
      totalFailed,
    };
  }

  /**
   * Generate batch using RunPod Serverless (PARALLEL, no rate limits!)
   */
  private async generateBatchWithRunPod(
    request: GenerateBatchRequest,
    onProgress?: (current: number, total: number, status: string) => void
  ): Promise<GenerateBatchResponse> {
    console.log(`[ImageGenerator] Batch: ${request.images.length} images with runpod-flux (parallel mode)`);

    const runpodRequests = request.images.map(img => {
      const { width, height } = this.aspectRatioToDimensions(img.aspectRatio || '1:1');
      return {
        id: img.id,
        prompt: img.prompt,
        negativePrompt: img.negativePrompt,
        width,
        height,
        seed: img.seed,
      };
    });

    const runpodResults = await this.runpod.generateBatch(runpodRequests, onProgress);

    const results = runpodResults.map(r => ({
      id: r.id,
      imageUrl: r.imageUrl,
      success: r.success,
      error: r.error,
    }));

    const totalGenerated = results.filter(r => r.success).length;
    const totalFailed = results.filter(r => !r.success).length;

    console.log(`[ImageGenerator] Batch complete: ${totalGenerated} success, ${totalFailed} failed`);

    return {
      results,
      provider: 'runpod-flux',
      totalGenerated,
      totalFailed,
    };
  }

  /**
   * Get available providers and their costs
   */
  getProviderInfo(): Record<ImageProvider, { name: string; costPerImage: string; speed: string }> {
    return {
      'flux-schnell': {
        name: 'Flux Schnell',
        costPerImage: '~$0.003',
        speed: 'Fast (~2s)',
      },
      'flux-dev': {
        name: 'Flux Dev',
        costPerImage: '~$0.025',
        speed: 'Medium (~5s)',
      },
      'flux-pro': {
        name: 'Flux 1.1 Pro',
        costPerImage: '~$0.04',
        speed: 'Slow (~8s)',
      },
      'runpod-flux': {
        name: 'RunPod Flux Dev',
        costPerImage: '~$0.003',
        speed: 'Medium (~5s) + cold start',
      },
    };
  }
}

export const imageGenerator = new ImageGenerator();
