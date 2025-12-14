import { AppMode, GenerationRequest } from '@kitsumy/types';
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { RunnableSequence } from "@langchain/core/runnables";
import { StructuredOutputParser } from "langchain/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { OpenAI } from "openai";
import Replicate from "replicate";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IMAGES_DIR = path.join(__dirname, '../../../web/public/generated');

// Text generation provider
type TextProvider = 'openai' | 'openrouter';
const TEXT_PROVIDER: TextProvider = (process.env.TEXT_PROVIDER as TextProvider) || 'openrouter';

// Image generation provider
type ImageProvider = 'dalle' | 'flux';
const IMAGE_PROVIDER: ImageProvider = (process.env.IMAGE_PROVIDER as ImageProvider) || 'flux';

// SCHEMAS

// 1. Architect: Structure + Tone
const outlineSchema = z.object({
  title: z.string(),
  chapters: z.array(z.object({
    title: z.string(),
    focus: z.string().describe("The emotional core or conflict of this chapter"),
    details: z.string().describe("Key historical facts to weave into the drama"),
    pov: z.string().describe("Whose eyes do we see this through? (e.g. 'A terrified radio operator', 'A stoic general')")
  })).describe("Break the story into 6-10 chapters. Chapter 1 MUST be a Prologue setting the atmosphere.")
});

// 2. Writer: Dramatic Script
const chapterBatchSchema = z.object({
  panels: z.array(z.object({
    narrative: z.string().describe("Literary narration. Describe smells, sounds, feelings. Avoid dry facts."),
    dialogue: z.array(z.object({
      speaker: z.string(),
      text: z.string().describe("Natural, emotional dialogue. Subtext over exposition.")
    })),
    visualPrompt: z.string()
  }))
});

interface Pipeline {
  generate(request: GenerationRequest): Promise<any>;
}

class DeepHistoryPipeline implements Pipeline {
  private model: ChatOpenAI;
  private outlineParser: StructuredOutputParser<typeof outlineSchema>;
  private chapterParser: StructuredOutputParser<typeof chapterBatchSchema>;
  private openai: OpenAI;
  private replicate: Replicate;

  private MOCK_IMAGES = false; // Enable real image generation

  constructor() {
    // Configure text generation model based on provider
    if (TEXT_PROVIDER === 'openrouter') {
      this.model = new ChatOpenAI({
        modelName: "deepseek/deepseek-chat", // DeepSeek V3: $0.14 input / $0.28 output per 1M tokens
        temperature: 0.7,
        configuration: {
          baseURL: "https://openrouter.ai/api/v1",
          defaultHeaders: {
            "HTTP-Referer": "https://kitsumy.com",
            "X-Title": "Kitsumy Comic Generator"
          }
        },
        apiKey: process.env.OPENROUTER_API_KEY,
      });
      console.log(`[TEXT] Using OpenRouter with deepseek/deepseek-chat`);
    } else {
      this.model = new ChatOpenAI({
        modelName: "gpt-4-turbo-preview",
        temperature: 0.7
      });
      console.log(`[TEXT] Using OpenAI GPT-4 Turbo`);
    }

    this.outlineParser = StructuredOutputParser.fromZodSchema(outlineSchema);
    this.chapterParser = StructuredOutputParser.fromZodSchema(chapterBatchSchema);
    this.openai = new OpenAI();
    this.replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });
  }

  async generate(req: GenerationRequest) {
    console.log(`[HISTORY] Starting Dramatic Dive for: ${req.prompt}`);

    // --- PHASE 1: ARCHITECTURE (With Drama) ---
    console.log(`[1/3] Designing the saga with POV...`);
    const outlineChain = RunnableSequence.from([
      PromptTemplate.fromTemplate(
        `You are a Showrunner for a high-budget HBO historical drama series about: {topic}.
        
        Create a season outline (6-10 episodes/chapters).
        
        CRITICAL RULES:
        1. NO textbook summaries. Focus on HUMAN DRAMA within historical events.
        2. Assign a specific POV (Point of View) for each chapter to ground it emotionally.
        3. Chapter 1 must be a moody PROLOGUE that establishes the stakes before the action starts.
        4. Chapter 2 should introduce the conflict through personal eyes.
        
        {format_instructions}`
      ),
      this.model,
      this.outlineParser
    ]);

    const outline = await outlineChain.invoke({
      topic: req.prompt,
      format_instructions: this.outlineParser.getFormatInstructions()
    });

    console.log(`[HISTORY] Saga Outline: ${outline.chapters.length} chapters.`);
    outline.chapters.forEach(c => console.log(`   - ${c.title} (POV: ${c.pov})`));

    // --- PHASE 2: SCRIPTWRITING (Cinematic) ---
    console.log(`[2/3] Writing cinematic scripts...`);
    
    const chapterChain = RunnableSequence.from([
      PromptTemplate.fromTemplate(
        `You are writing the script for Chapter "{chapter_title}" of "{book_title}".
        
        CONTEXT:
        Focus: {chapter_focus}
        POV Character: {chapter_pov}
        Historical Facts: {chapter_details}

        TASK:
        Write 3-5 comic panels.
        
        STYLE GUIDE:
        - NARRATIVE: Noir-style, atmospheric, sensory. "The smell of cordite hung low..." not "The battle started."
        - DIALOGUE: Short, punchy, realistic. No "As you know, Bob" exposition.
        - VISUALS: Cinematic angles. Close-ups on eyes, hands, objects.
        
        {format_instructions}`
      ),
      this.model,
      this.chapterParser
    ]);

    const chapterResults = await Promise.all(outline.chapters.map(async (chapter, i) => {
      console.log(`   > Drafting Chapter ${i+1} [${chapter.pov}]...`);
      try {
        const result = await chapterChain.invoke({
          book_title: outline.title,
          chapter_title: chapter.title,
          chapter_focus: chapter.focus,
          chapter_details: chapter.details,
          chapter_pov: chapter.pov,
          format_instructions: this.chapterParser.getFormatInstructions()
        });
        return result.panels.map(p => ({ ...p, chapterTitle: chapter.title }));
      } catch (e) {
        console.error(`   ! Failed Chapter ${i+1}`, e);
        return [];
      }
    }));

    const fullScript = chapterResults.flat();
    console.log(`[HISTORY] Full script ready: ${fullScript.length} panels.`);

    // --- PHASE 3: VISUALIZATION ---
    console.log(`[3/3] Rendering images (MOCK: ${this.MOCK_IMAGES})...`);

    // Ensure images directory exists
    if (!fs.existsSync(IMAGES_DIR)) {
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }

    const downloadAndSaveImage = async (url: string, filename: string): Promise<string> => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);

        const buffer = await response.arrayBuffer();
        const filepath = path.join(IMAGES_DIR, filename);
        fs.writeFileSync(filepath, Buffer.from(buffer));

        return `/generated/${filename}`;
      } catch (e: any) {
        console.error(`[IMAGE] Download failed: ${e.message}`);
        throw e;
      }
    };

    const enhanceImage = async (filepath: string): Promise<void> => {
      try {
        const image = sharp(filepath);
        const metadata = await image.metadata();

        // Comic book enhancement pipeline
        await image
          .modulate({
            brightness: 1.05,      // Slight brightness boost
            saturation: 1.25,      // 25% more saturation for vibrant colors
          })
          .sharpen({
            sigma: 1.2,            // Edge enhancement for crisp lines
            m1: 0.8,               // Gentle sharpening
            m2: 0.2
          })
          .linear(1.1, -(128 * 0.1))  // Increase contrast slightly
          .toFile(filepath + '.tmp');

        // Replace original with enhanced version
        fs.renameSync(filepath + '.tmp', filepath);
        console.log(`[IMAGE] Enhanced: ${path.basename(filepath)}`);
      } catch (e: any) {
        console.error(`[IMAGE] Enhancement failed for ${path.basename(filepath)}: ${e.message}`);
        // Continue without enhancement if it fails
      }
    };

    const generateImage = async (prompt: string, idx: number, retries = 5): Promise<string> => {
        if (this.MOCK_IMAGES) {
            return `https://placehold.co/1024x1024/222/FFF?text=${encodeURIComponent(prompt.slice(0,30))}`;
        }

        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            console.log(`[IMAGE ${idx + 1}] Generating with ${IMAGE_PROVIDER.toUpperCase()} (attempt ${attempt}/${retries})...`);

            // Sanitize prompt for safety system
            let safePrompt = prompt
              .replace(/gun|weapon|blood|violence|war|battle|fight|attack|kill/gi, '')
              .replace(/\s+/g, ' ')
              .trim();

            // If prompt becomes too short after sanitization, use generic description
            if (safePrompt.length < 20) {
              safePrompt = 'A dramatic historical scene with people and period-accurate setting';
            }

            let imageUrl: string;

            if (IMAGE_PROVIDER === 'flux') {
              // Generate with Replicate Flux Schnell
              const output = await this.replicate.run(
                "black-forest-labs/flux-schnell:c846a69991daf4c0e5d016514849d14ee5b2e6846ce6b9d6f21369e564cfe51e",
                {
                  input: {
                    prompt: `Comic book panel illustration. ${safePrompt}. Professional comic art style, detailed, vibrant colors, dramatic composition.`,
                    num_outputs: 1,
                    aspect_ratio: "1:1",
                    output_format: "png",
                    output_quality: 90
                  }
                }
              );

              imageUrl = Array.isArray(output) ? output[0] : output as string;
            } else {
              // Generate with DALL-E 3
              const res = await this.openai.images.generate({
                  model: "dall-e-3",
                  prompt: `Educational illustration in comic book art style. ${safePrompt}. Professional artistic quality, historical accuracy, cinematic composition.`,
                  n: 1,
                  size: "1024x1024",
                  quality: "standard"
              });

              imageUrl = res.data[0].url || '';
            }

            if (!imageUrl) throw new Error('No URL returned from image generation');

            console.log(`[IMAGE ${idx + 1}] Generated, downloading...`);
            const filename = `panel-${Date.now()}-${idx}.png`;
            const localUrl = await downloadAndSaveImage(imageUrl, filename);

            // Apply comic book enhancement
            const filepath = path.join(IMAGES_DIR, filename);
            await enhanceImage(filepath);

            console.log(`[IMAGE ${idx + 1}] Saved and enhanced as ${filename}`);
            return localUrl;
          } catch (e: any) {
            const errorDetails = {
              timestamp: new Date().toISOString(),
              imageIndex: idx + 1,
              attempt,
              provider: IMAGE_PROVIDER,
              error: e.message,
              prompt: prompt.slice(0, 100),
              statusCode: e.response?.status || 'unknown',
              errorData: e.response?.data || e.toString()
            };

            console.error(`[IMAGE ${idx + 1}] Attempt ${attempt} failed: ${e.message}`);

            // Log detailed error to file
            const logDir = path.join(__dirname, '../../../logs');
            if (!fs.existsSync(logDir)) {
              fs.mkdirSync(logDir, { recursive: true });
            }
            fs.appendFileSync(
              path.join(logDir, 'image-errors.log'),
              JSON.stringify(errorDetails, null, 2) + '\n---\n'
            );

            if (attempt === retries) {
              console.error(`[IMAGE ${idx + 1}] All retries exhausted, using placeholder`);
              return `https://placehold.co/1024x1024/500/FFF?text=Error`;
            }

            // Wait before retry (exponential backoff: 2s, 4s, 6s, 8s, 10s)
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          }
        }

        return `https://placehold.co/1024x1024/500/FFF?text=Error`;
    };

    // Generate images with rate limiting (1 per batch to respect Replicate limits for accounts < $5)
    const finalPanels = [];
    const BATCH_SIZE = 1; // Reduced from 5 to 1 to avoid rate limits
    const BATCH_DELAY = 12000; // 12 seconds between images (5 per minute = safe buffer)

    for (let i = 0; i < fullScript.length; i += BATCH_SIZE) {
      const batch = fullScript.slice(i, i + BATCH_SIZE);
      console.log(`[IMAGES] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(fullScript.length / BATCH_SIZE)}`);

      const batchResults = await Promise.all(batch.map(async (panel, batchIdx) => ({
        id: `p-${i + batchIdx}`,
        ...panel,
        imageUrl: await generateImage(panel.visualPrompt, i + batchIdx)
      })));

      finalPanels.push(...batchResults);

      // Wait before next batch (except for the last one)
      if (i + BATCH_SIZE < fullScript.length) {
        console.log(`[IMAGES] Waiting 60s before next batch to avoid rate limits...`);
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    return {
      type: 'comic',
      title: outline.title,
      chapters: outline.chapters,
      panels: finalPanels
    };
  }
}

export class Orchestrator {
  private pipelines: Record<AppMode, Pipeline>;

  constructor() {
    const deepHistory = new DeepHistoryPipeline();
    this.pipelines = {
      [AppMode.LEARNING]: deepHistory,
      [AppMode.CREATIVE]: deepHistory,
      [AppMode.THERAPY]: deepHistory,
    };
  }

  async dispatch(request: GenerationRequest) {
    const pipeline = this.pipelines[request.mode];
    if (!pipeline) throw new Error('Invalid mode');
    return await pipeline.generate(request);
  }
}
