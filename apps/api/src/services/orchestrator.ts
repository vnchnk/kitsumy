import { AppMode, GenerationRequest } from '@kitsumy/types';
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { RunnableSequence } from "@langchain/core/runnables";
import { StructuredOutputParser } from "langchain/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { OpenAI } from "openai";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IMAGES_DIR = path.join(__dirname, '../../../web/public/generated');

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

  private MOCK_IMAGES = false; // Enable real DALL-E 3 image generation 

  constructor() {
    this.model = new ChatOpenAI({ 
      modelName: "gpt-4-turbo-preview", 
      temperature: 0.7 
    });
    this.outlineParser = StructuredOutputParser.fromZodSchema(outlineSchema);
    this.chapterParser = StructuredOutputParser.fromZodSchema(chapterBatchSchema);
    this.openai = new OpenAI();
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

    const generateImage = async (prompt: string, idx: number, retries = 3): Promise<string> => {
        if (this.MOCK_IMAGES) {
            return `https://placehold.co/1024x1024/222/FFF?text=${encodeURIComponent(prompt.slice(0,30))}`;
        }

        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            console.log(`[IMAGE ${idx + 1}] Generating (attempt ${attempt}/${retries})...`);

            // Sanitize prompt for safety system
            let safePrompt = prompt
              .replace(/gun|weapon|blood|violence|war|battle|fight|attack|kill/gi, '')
              .replace(/\s+/g, ' ')
              .trim();

            // If prompt becomes too short after sanitization, use generic description
            if (safePrompt.length < 20) {
              safePrompt = 'A dramatic historical scene with people and period-accurate setting';
            }

            const res = await this.openai.images.generate({
                model: "dall-e-3",
                prompt: `Educational illustration in comic book art style. ${safePrompt}. Professional artistic quality, historical accuracy, cinematic composition.`,
                n: 1,
                size: "1024x1024",
                quality: "standard"
            });

            const dalleUrl = res.data[0].url;
            if (!dalleUrl) throw new Error('No URL returned from DALL-E');

            console.log(`[IMAGE ${idx + 1}] Generated, downloading...`);
            const filename = `panel-${Date.now()}-${idx}.png`;
            const localUrl = await downloadAndSaveImage(dalleUrl, filename);

            console.log(`[IMAGE ${idx + 1}] Saved as ${filename}`);
            return localUrl;
          } catch (e: any) {
            console.error(`[IMAGE ${idx + 1}] Attempt ${attempt} failed: ${e.message}`);

            if (attempt === retries) {
              console.error(`[IMAGE ${idx + 1}] All retries exhausted, using placeholder`);
              return `https://placehold.co/1024x1024/500/FFF?text=Error`;
            }

            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }

        return `https://placehold.co/1024x1024/500/FFF?text=Error`;
    };

    // Generate images with rate limiting (max 5 per minute to be safe)
    const finalPanels = [];
    const BATCH_SIZE = 5;
    const BATCH_DELAY = 60000; // 1 minute

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
