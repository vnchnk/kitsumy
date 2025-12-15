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
type ImageProvider = 'dalle' | 'flux-schnell' | 'flux-dev' | 'flux-pro';
const IMAGE_PROVIDER: ImageProvider = (process.env.IMAGE_PROVIDER as ImageProvider) || 'flux-pro';

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

  // Колекція стилів для генерації коміксів
  private static readonly COMIC_STYLES: Record<string, { name: string; prompt: string; avoid: string }> = {
    // Classic American Comics (Marvel/DC style)
    'american-classic': {
      name: 'American Classic',
      prompt: [
        "Classic American comic book illustration in the style of Jack Kirby and Jim Lee",
        "Bold black ink outlines with dynamic crosshatching",
        "Vibrant four-color printing palette with Ben-Day dots",
        "Dramatic foreshortening and heroic poses",
        "Heavy shadows with stark contrast",
        "Action lines and speed streaks",
        "Muscular anatomy and expressive faces",
        "Panel-ready composition with clear focal points"
      ].join(", "),
      avoid: "photorealistic, anime style, watercolor, soft edges, muted colors"
    },

    // Noir / Sin City style
    'noir': {
      name: 'Noir',
      prompt: [
        "Film noir comic book style inspired by Frank Miller's Sin City",
        "High contrast black and white with selective spot color",
        "Deep dramatic shadows consuming most of the frame",
        "Harsh angular lighting from single sources",
        "Gritty urban atmosphere with rain and smoke",
        "Silhouettes and stark negative space",
        "Weathered textures and rough edges",
        "Moody atmospheric perspective"
      ].join(", "),
      avoid: "colorful, bright, cheerful, soft lighting, anime, cartoon"
    },

    // Manga / Anime style
    'manga': {
      name: 'Manga',
      prompt: [
        "Japanese manga illustration style",
        "Clean precise linework with varying line weights",
        "Large expressive eyes with detailed highlights",
        "Screentone shading patterns and speed lines",
        "Dynamic action poses with exaggerated motion",
        "Emotional expressions with sweat drops and effect lines",
        "Detailed hair with flowing strands",
        "Atmospheric backgrounds with selective detail"
      ].join(", "),
      avoid: "western comic style, realistic proportions, painted, rough sketch"
    },

    // European / Bande Dessinée style (Tintin, Moebius)
    'euro-bd': {
      name: 'European BD',
      prompt: [
        "European bande dessinée illustration style inspired by Hergé and Moebius",
        "Ligne claire technique with uniform line weights",
        "Flat vibrant colors with minimal gradients",
        "Highly detailed architectural and mechanical backgrounds",
        "Clean readable compositions with clear staging",
        "Realistic proportions with slight stylization",
        "Rich environmental storytelling",
        "Elegant linework with no crosshatching"
      ].join(", "),
      avoid: "heavy shadows, gritty, sketchy, anime style, photorealistic"
    },

    // Watercolor / Painted style
    'watercolor': {
      name: 'Watercolor',
      prompt: [
        "Painted watercolor comic illustration style",
        "Soft flowing color washes with visible brush strokes",
        "Delicate ink linework underneath translucent colors",
        "Organic color bleeds and wet-on-wet effects",
        "Luminous highlights and soft shadows",
        "Dreamy atmospheric quality",
        "Textured watercolor paper visible",
        "Expressive loose brushwork with controlled details"
      ].join(", "),
      avoid: "digital, cel-shaded, hard edges, flat colors, vector art"
    },

    // Retro / Vintage style (50s-60s)
    'retro': {
      name: 'Retro Vintage',
      prompt: [
        "Vintage 1950s-60s comic book illustration style",
        "Limited color palette with halftone dot printing effect",
        "Slightly faded and aged paper texture",
        "Classic romance and horror comic aesthetics",
        "Melodramatic expressions and poses",
        "Hand-lettered style elements",
        "Period-accurate fashion and styling",
        "Nostalgic warm color tones with cyan and magenta"
      ].join(", "),
      avoid: "modern, digital, clean, minimalist, anime"
    },

    // Cyberpunk / Sci-Fi style
    'cyberpunk': {
      name: 'Cyberpunk',
      prompt: [
        "Cyberpunk sci-fi comic illustration style",
        "Neon color palette with hot pink, electric blue, and toxic green",
        "High-tech low-life urban environments",
        "Holographic effects and digital glitches",
        "Rain-slicked streets reflecting neon signs",
        "Cybernetic implants and futuristic technology",
        "Dense layered cityscapes with vertical depth",
        "Dramatic rim lighting and lens flares"
      ].join(", "),
      avoid: "natural, pastoral, historical, muted colors, traditional"
    },

    // Children's Book / Whimsical style
    'whimsical': {
      name: 'Whimsical',
      prompt: [
        "Whimsical children's book illustration style",
        "Soft rounded shapes and friendly character designs",
        "Pastel color palette with warm accents",
        "Playful exaggerated proportions",
        "Gentle shading with soft edges",
        "Storybook quality with magical atmosphere",
        "Expressive cute character faces",
        "Decorative natural elements like flowers and stars"
      ].join(", "),
      avoid: "dark, gritty, realistic, violent, scary, horror"
    },

    // Horror / Dark Fantasy style
    'horror': {
      name: 'Horror',
      prompt: [
        "Dark horror comic illustration style inspired by Bernie Wrightson and Mike Mignola",
        "Heavy black shadows with minimal light sources",
        "Grotesque detailed creature designs",
        "Gothic architecture and twisted environments",
        "Unsettling atmosphere with fog and darkness",
        "Bold graphic shapes with intricate line detail",
        "Eerie color palette of deep reds, sickly greens, and midnight blues",
        "Dramatic chiaroscuro lighting"
      ].join(", "),
      avoid: "bright, cheerful, cute, pastel, clean, minimalist"
    },

    // Minimalist / Modern style
    'minimalist': {
      name: 'Minimalist',
      prompt: [
        "Minimalist modern comic illustration style",
        "Simple clean geometric shapes",
        "Limited color palette with bold accent colors",
        "Generous white space and breathing room",
        "Flat design with subtle shadows",
        "Strong silhouettes and clear readability",
        "Contemporary graphic design influenced",
        "Elegant simplicity with purposeful details"
      ].join(", "),
      avoid: "detailed, busy, crosshatching, gradients, realistic, ornate"
    },

    // Ukiyo-e / Japanese Woodblock Print style
    'ukiyo-e': {
      name: 'Ukiyo-e',
      prompt: [
        "Traditional Japanese ukiyo-e woodblock print illustration style",
        "Flat areas of color with bold black outlines",
        "Distinctive wave patterns and nature motifs inspired by Hokusai",
        "Elegant flowing lines depicting fabric and hair",
        "Limited traditional color palette with indigo, vermillion, and earth tones",
        "Stylized clouds, water, and mountain forms",
        "Decorative patterns and textile details",
        "Asymmetrical compositions with dramatic perspective"
      ].join(", "),
      avoid: "photorealistic, 3D shading, western style, modern, digital effects"
    },

    // Pop Art / Lichtenstein style
    'pop-art': {
      name: 'Pop Art',
      prompt: [
        "Pop art comic illustration in the style of Roy Lichtenstein",
        "Bold Ben-Day dots pattern filling large areas",
        "Primary colors: bright red, yellow, blue with black outlines",
        "Thick black outlines with clean graphic shapes",
        "Dramatic close-ups of faces and objects",
        "Speech bubbles and onomatopoeia text effects",
        "High contrast with flat color areas",
        "Commercial advertising aesthetic from 1960s"
      ].join(", "),
      avoid: "subtle gradients, muted colors, realistic shading, soft edges, painterly"
    },

    // Sketch / Storyboard style
    'sketch': {
      name: 'Sketch',
      prompt: [
        "Rough pencil sketch storyboard illustration style",
        "Loose gestural pencil strokes and hatching",
        "Unfinished raw artistic quality",
        "Visible construction lines and corrections",
        "Grayscale with occasional color wash accents",
        "Dynamic rough energy in line quality",
        "Concept art and production design aesthetic",
        "Expressive quick sketchy linework"
      ].join(", "),
      avoid: "polished, clean lines, digital, finished, colorful, perfect"
    },

    // Cel-Shaded / Video Game style
    'cel-shaded': {
      name: 'Cel-Shaded',
      prompt: [
        "Cel-shaded 3D render style like Borderlands and Spider-Verse",
        "Bold black ink outlines on 3D forms",
        "Flat color shading with hard shadow edges",
        "Vibrant saturated color palette",
        "Comic book halftone and speed line effects",
        "Exaggerated stylized proportions",
        "Dynamic camera angles and poses",
        "Hand-drawn texture overlays on smooth surfaces"
      ].join(", "),
      avoid: "photorealistic, soft gradients, traditional 2D, muted colors, realistic lighting"
    },

    // Pulp Fiction / 1930s-40s style
    'pulp': {
      name: 'Pulp Fiction',
      prompt: [
        "1930s-40s pulp magazine cover illustration style",
        "Dramatic painted realism with bold colors",
        "Sensational action scenes and dangerous situations",
        "Femme fatales and hard-boiled detectives",
        "Warm sepia and amber tones with splashes of red",
        "Theatrical lighting with deep shadows",
        "Vintage printing texture and grain",
        "Adventure and mystery atmosphere"
      ].join(", "),
      avoid: "modern, clean, minimalist, anime, cute, digital"
    },

    // Woodcut / Medieval Print style
    'woodcut': {
      name: 'Woodcut',
      prompt: [
        "Medieval woodcut print illustration style",
        "Bold black lines carved into wood block aesthetic",
        "High contrast black and white with no gradients",
        "Rough textured edges and imperfect lines",
        "Cross-hatching for shading and depth",
        "Historical manuscript and early printing press look",
        "Gothic and medieval subject matter styling",
        "Dramatic religious iconography influence"
      ].join(", "),
      avoid: "colorful, smooth gradients, photorealistic, modern, digital, anime"
    },

    // Art Nouveau / Mucha style
    'art-nouveau': {
      name: 'Art Nouveau',
      prompt: [
        "Art Nouveau illustration style inspired by Alphonse Mucha",
        "Elegant flowing organic lines and curves",
        "Decorative floral and botanical frames",
        "Beautiful women with flowing hair and robes",
        "Muted earth tones with gold accents",
        "Intricate ornamental borders and patterns",
        "Symmetrical compositions with central figures",
        "Romantic and dreamy atmosphere"
      ].join(", "),
      avoid: "harsh angles, gritty, modern, minimalist, cartoon, anime"
    },

    // Graffiti / Street Art style
    'graffiti': {
      name: 'Graffiti',
      prompt: [
        "Urban street art graffiti illustration style",
        "Bold spray paint aesthetic with drips and splatters",
        "Vibrant neon colors on concrete and brick textures",
        "Wildstyle lettering and tag influences",
        "Stencil art and wheat paste poster elements",
        "Urban decay and city environment backgrounds",
        "Bold outlines with gradient fills",
        "Raw rebellious energy and street culture"
      ].join(", "),
      avoid: "clean, polished, traditional, fine art, subtle, muted colors"
    },

    // Chibi / Super-deformed style
    'chibi': {
      name: 'Chibi',
      prompt: [
        "Chibi super-deformed cute illustration style",
        "Oversized heads with tiny bodies (2-3 head ratio)",
        "Large sparkling eyes with simple features",
        "Rounded soft shapes and pudgy proportions",
        "Bright cheerful pastel and candy colors",
        "Exaggerated cute expressions and emotions",
        "Simple hands and feet with minimal details",
        "Kawaii Japanese aesthetic with sparkles and hearts"
      ].join(", "),
      avoid: "realistic proportions, dark, gritty, detailed anatomy, horror, mature"
    },

    // Soviet Propaganda Poster style
    'soviet-poster': {
      name: 'Soviet Poster',
      prompt: [
        "Soviet constructivist propaganda poster illustration style",
        "Bold red, black, and gold color palette",
        "Strong geometric shapes and diagonal compositions",
        "Heroic worker and peasant figures",
        "Dramatic upward-looking perspective",
        "Bold sans-serif typography integration",
        "Flat graphic shapes with minimal shading",
        "Revolutionary and industrial imagery"
      ].join(", "),
      avoid: "soft, pastel, detailed, realistic shading, cute, western style"
    }
  };

  // Поточний стиль (можна змінювати через request)
  private currentStyle: string = 'american-classic';

  private getImageStylePrompt(visualPrompt: string, style?: string): string {
    const selectedStyle = DeepHistoryPipeline.COMIC_STYLES[style || this.currentStyle]
      || DeepHistoryPipeline.COMIC_STYLES['american-classic'];

    return `${selectedStyle.prompt}. Scene: ${visualPrompt}. Avoid: ${selectedStyle.avoid}`;
  }

  // Метод для отримання списку доступних стилів
  static getAvailableStyles(): Array<{ id: string; name: string }> {
    return Object.entries(DeepHistoryPipeline.COMIC_STYLES).map(([id, style]) => ({
      id,
      name: style.name
    }));
  }

  async generate(req: GenerationRequest) {
    console.log(`[DEBUG] Received request:`, JSON.stringify(req, null, 2));
    const maxPages = req.maxPages ?? 999; // Default: all pages
    const style = req.style || 'american-classic'; // Default style
    console.log(`[STYLE] Using style: ${style}`);
    const maxPanels = maxPages * 4; // Estimate 3-4 panels per page average

    console.log(`[HISTORY] Starting generation for: ${req.prompt} (Max pages: ${maxPages}, maxPanels: ${maxPanels})`);

    // --- PHASE 1: ARCHITECTURE (With Drama) ---
    console.log(`[1/3] Designing the saga with POV...`);

    // Визначаємо кількість розділів на основі maxPages
    const targetChapters = Math.min(Math.max(1, maxPages), 10);

    const outlineChain = RunnableSequence.from([
      PromptTemplate.fromTemplate(
        `You are a Showrunner for a high-budget HBO historical drama series about: {topic}.

        Create a season outline with EXACTLY {target_chapters} chapter(s).

        CRITICAL RULES:
        1. NO textbook summaries. Focus on HUMAN DRAMA within historical events.
        2. Assign a specific POV (Point of View) for each chapter to ground it emotionally.
        3. If only 1 chapter: make it a complete, self-contained dramatic scene.
        4. If multiple chapters: Chapter 1 must be a moody PROLOGUE.

        {format_instructions}`
      ),
      this.model,
      this.outlineParser
    ]);

    const outline = await outlineChain.invoke({
      topic: req.prompt,
      target_chapters: targetChapters.toString(),
      format_instructions: this.outlineParser.getFormatInstructions()
    });

    // Limit chapters based on maxPages (roughly 1 chapter = 4 panels = 1 page)
    const maxChapters = Math.max(1, maxPages);
    if (outline.chapters.length > maxChapters) {
      console.log(`[HISTORY] Limiting chapters from ${outline.chapters.length} to ${maxChapters}`);
      outline.chapters = outline.chapters.slice(0, maxChapters);
    }
    
    console.log(`[HISTORY] Saga Outline: ${outline.chapters.length} chapters.`);
    outline.chapters.forEach(c => console.log(`   - ${c.title} (POV: ${c.pov})`));

    // --- PHASE 2: SCRIPTWRITING (Cinematic) ---
    console.log(`[2/3] Writing cinematic scripts...`);

    // Для тестування (1 сторінка) — менше панелей
    const panelsPerChapter = maxPages === 1 ? "2-3" : "3-5";

    const chapterChain = RunnableSequence.from([
      PromptTemplate.fromTemplate(
        `You are writing the script for Chapter "{chapter_title}" of "{book_title}".

        CONTEXT:
        Focus: {chapter_focus}
        POV Character: {chapter_pov}
        Historical Facts: {chapter_details}

        TASK:
        Write {panels_count} comic panels.

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
          panels_count: panelsPerChapter,
          format_instructions: this.chapterParser.getFormatInstructions()
        });
        return result.panels.map(p => ({ ...p, chapterTitle: chapter.title }));
      } catch (e) {
        console.error(`   ! Failed Chapter ${i+1}`, e);
        return [];
      }
    }));

    let fullScript = chapterResults.flat();

    // Limit panels based on maxPages
    if (fullScript.length > maxPanels) {
      console.log(`[HISTORY] Limiting from ${fullScript.length} to ${maxPanels} panels (${maxPages} pages)`);
      fullScript = fullScript.slice(0, maxPanels);
    }

    console.log(`[HISTORY] Full script ready: ${fullScript.length} panels.`);

    // --- PHASE 3: VISUALIZATION ---
    console.log(`[3/3] Rendering images with ${IMAGE_PROVIDER.toUpperCase()} (MOCK: ${this.MOCK_IMAGES})...`);

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
            const fullPrompt = this.getImageStylePrompt(safePrompt, style);

            if (IMAGE_PROVIDER === 'flux-pro') {
              // Generate with Flux 2.0 Pro (найкраща якість)
              const output = await this.replicate.run(
                "black-forest-labs/flux-2-pro:285631b5656a1839331cd9af0d82da820e2075db12046d1d061c681b2f206bc6",
                {
                  input: {
                    prompt: fullPrompt,
                    aspect_ratio: "1:1",
                    output_format: "png",
                    output_quality: 95,
                    safety_tolerance: 3,
                    prompt_upsampling: true
                  }
                }
              );

              imageUrl = Array.isArray(output) ? output[0] : output as string;
            } else if (IMAGE_PROVIDER === 'flux-dev') {
              // Generate with Flux 1.1 Dev (баланс якість/ціна)
              const output = await this.replicate.run(
                "black-forest-labs/flux-dev",
                {
                  input: {
                    prompt: fullPrompt,
                    num_outputs: 1,
                    aspect_ratio: "1:1",
                    output_format: "png",
                    output_quality: 90,
                    go_fast: true
                  }
                }
              );

              imageUrl = Array.isArray(output) ? output[0] : output as string;
            } else if (IMAGE_PROVIDER === 'flux-schnell') {
              // Generate with Flux Schnell (найшвидша/найдешевша)
              const output = await this.replicate.run(
                "black-forest-labs/flux-schnell",
                {
                  input: {
                    prompt: fullPrompt,
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
                  prompt: fullPrompt,
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

    // Generate images with rate limiting
    const finalPanels = [];
    const BATCH_SIZE = 1;
    // Flux Pro генерує ~6 сек, тому можна швидше
    const BATCH_DELAY = IMAGE_PROVIDER === 'flux-pro' ? 3000 : 12000;

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
        console.log(`[IMAGES] Waiting ${BATCH_DELAY/1000}s before next image...`);
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
