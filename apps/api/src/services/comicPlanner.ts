import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { HumanMessage } from "@langchain/core/messages";
import JSON5 from "json5";
import {
  ComicPlanRequest,
  ComicPlan,
  ComicCharacter,
  ComicChapter,
  ComicPage,
  PanelPlan,
  PageLayout,
  PageScene,
  CharacterInPanel,
  LAYOUT_PANEL_COUNT,
  LAYOUT_SLOTS,
  AspectRatio,
  BodyType,
  FacialExpression,
  PanelDialogue,
  ComicStyle,
  ComicSetting,
  COMIC_STYLE_PROMPTS,
  COMIC_SETTING_PROMPTS,
} from '@kitsumy/types';
import dotenv from 'dotenv';

dotenv.config();

// Force flush logging for concurrently compatibility
const log = (message: string) => {
  process.stdout.write(message + '\n');
};

// ============================================
// Zod Schemas
// ============================================

const bodyTypes: BodyType[] = ['slim', 'average', 'athletic', 'muscular', 'heavy', 'petite'];
const expressions: FacialExpression[] = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'surprised', 'disgusted', 'contempt', 'determined', 'worried', 'pensive', 'smirking', 'crying', 'laughing', 'focused', 'confused', 'shocked', 'relieved', 'hopeful'];

const characterSchema = z.object({
  characters: z.array(z.object({
    name: z.string(),
    age: z.number(),
    gender: z.enum(['male', 'female', 'other']),
    bodyType: z.enum(bodyTypes as [string, ...string[]]),
    height: z.string(),
    face: z.object({
      shape: z.string(),
      eyes: z.string(),
      nose: z.string(),
      mouth: z.string(),
      hair: z.string(),
      distinctiveFeatures: z.string(),
    }),
    skinTone: z.string(),
    defaultExpression: z.enum(expressions as [string, ...string[]]),
    clothing: z.string(),
    role: z.string(),
  }))
});

const structureSchema = z.object({
  title: z.string(),
  chapters: z.array(z.object({
    title: z.string(),
    pages: z.array(z.object({
      layout: z.enum([
        'single', 'two-horizontal', 'two-vertical', 'three-rows',
        'grid-2x2', 'big-left', 'big-right', 'big-top', 'big-bottom',
        'strip-3', 'manga-3', 'action'
      ]),
      summary: z.string(),
      charactersInScene: z.array(z.string()), // ["char-1", "char-2"] or ["char-1", "anonymous-editor"]
      scene: z.object({
        location: z.string(),
        weather: z.string().optional(),
        timeOfDay: z.string().optional(),
      }),
    }))
  }))
});

// Schema for Chain-of-Thought page planning
const pageThinkingSchema = z.object({
  storyBeats: z.array(z.string()),
  emotionalArc: z.string(),
  keyMoments: z.array(z.string()),
  panelBreakdown: z.array(z.object({
    panelNumber: z.number(),
    purpose: z.string(),
    suggestedShot: z.string(),
    suggestedAngle: z.string(),
  }))
});

// Schema for single panel generation
// Using strings instead of enums for creative flexibility
const singlePanelSchema = z.object({
  characters: z.array(z.object({
    characterId: z.string(),
    expression: z.string(),
    pose: z.string(),
    gesture: z.string().nullable().optional(),
    gazeDirection: z.string().nullable().optional(),
  })).nullable().optional().default([]),
  action: z.string(),
  mood: z.string(),
  camera: z.object({
    shot: z.string(),   // flexible: "close-up", "extreme close-up on hands", etc.
    angle: z.string(),  // flexible: "low-angle", "slightly tilted", etc.
    focus: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  }),
  dialogue: z.array(z.object({
    characterId: z.string(),
    text: z.string(),
    placement: z.enum([
      'top-left', 'top-center', 'top-right',
      'middle-left', 'middle-center', 'middle-right',
      'bottom-left', 'bottom-center', 'bottom-right'
    ]).optional(), // 9-zone grid placement
  })).nullable().optional().default([]),
  narrative: z.string().nullable().optional().default(null),
  narrativePlacement: z.enum([
    'top-left', 'top-center', 'top-right',
    'middle-left', 'middle-center', 'middle-right',
    'bottom-left', 'bottom-center', 'bottom-right'
  ]).nullable().optional(),
  sfx: z.string().nullable().optional().default(null),
  // Image generation prompts for Flux
  imagePrompt: z.string(), // Ready-to-use prompt for Flux
  negativePrompt: z.string().nullable().optional(), // What to avoid
});

// Schema for self-review
const reviewSchema = z.object({
  issues: z.array(z.object({
    panelId: z.string(),
    type: z.enum(['repetition', 'language', 'continuity', 'character', 'scene-mismatch', 'other']),
    description: z.string(),
    fix: z.string(),
  })),
  overallQuality: z.enum(['good', 'needs_fixes', 'poor']),
});

// Style prompts imported from @kitsumy/types: COMIC_STYLE_PROMPTS, COMIC_SETTING_PROMPTS
// Helper to get style prompts with fallback for unknown styles
const getStylePrompts = (style: string) => {
  return COMIC_STYLE_PROMPTS[style as ComicStyle] || {
    prefix: 'comic book panel illustration,',
    suffix: 'professional comic art style'
  };
};

const getSettingPrompt = (setting: string) => {
  return COMIC_SETTING_PROMPTS[setting as ComicSetting] || '';
};

// ============================================
// Few-Shot Examples
// ============================================

const FEW_SHOT_PANEL_EXAMPLE_UK = `
ПРИКЛАД ЯКІСНОЇ ПАНЕЛІ (зверніть увагу на формат imagePrompt - стиль НА ПОЧАТКУ і В КІНЦІ, та КОМПОЗИЦІЮ для тексту):
{
  "characters": [
    {
      "characterId": "char-1",
      "expression": "determined",
      "pose": "crouching",
      "gesture": "тримає рацію біля вуха",
      "gazeDirection": "на горизонт"
    }
  ],
  "action": "Сержант притискається до землі за укриттям, слухаючи потріскування рації",
  "mood": "напружений",
  "camera": {
    "shot": "medium-close-up",
    "angle": "low-angle",
    "focus": "char-1"
  },
  "dialogue": [
    { "characterId": "char-1", "text": "Друга рота, відповідайте!", "placement": "top-right" }
  ],
  "narrative": "Зв'язок обірвався три хвилини тому.",
  "narrativePlacement": "top-left",
  "sfx": "КРРРР...",
  "imagePrompt": "comic book panel illustration, professional comic art, medium-close-up low-angle shot, determined soldier crouching behind cover holding radio to ear, olive skin short black hair slicked back, military uniform, battlefield dawn smoke debris, asymmetrical composition leaving room for speech bubbles in top corners, negative space for text, tense atmosphere, Marvel DC comic book style, bold ink lines, dynamic composition, vibrant saturated colors, halftone dots texture, classic American comic aesthetic",
  "negativePrompt": "realistic photo, photorealistic, 3D render, photograph, blurry, text, speech bubbles, watermark, face filling entire frame, no room for text"
}`;

const FEW_SHOT_PANEL_EXAMPLE_EN = `
EXAMPLE OF QUALITY PANEL (note imagePrompt format - style at START and END, and COMPOSITION for text):
{
  "characters": [
    {
      "characterId": "char-1",
      "expression": "determined",
      "pose": "crouching",
      "gesture": "holding radio to ear",
      "gazeDirection": "at the horizon"
    }
  ],
  "action": "The sergeant presses himself to the ground behind cover, listening to the crackling radio",
  "mood": "tense",
  "camera": {
    "shot": "medium-close-up",
    "angle": "low-angle",
    "focus": "char-1"
  },
  "dialogue": [
    { "characterId": "char-1", "text": "Second company, respond!", "placement": "top-right" }
  ],
  "narrative": "The connection broke three minutes ago.",
  "narrativePlacement": "top-left",
  "sfx": "CRACKLE...",
  "imagePrompt": "comic book panel illustration, professional comic art, medium-close-up low-angle shot, determined soldier crouching behind cover holding radio to ear, olive skin short black hair slicked back, military uniform, battlefield dawn smoke debris, asymmetrical composition leaving room for speech bubbles in top corners, negative space for text, tense atmosphere, Marvel DC comic book style, bold ink lines, dynamic composition, vibrant saturated colors, halftone dots texture, classic American comic aesthetic",
  "negativePrompt": "realistic photo, photorealistic, 3D render, photograph, blurry, text, speech bubbles, watermark, face filling entire frame, no room for text"
}`;

// ============================================
// JSON Parser
// ============================================

function parseJSON<T>(text: string, schema: z.ZodSchema<T>): T {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  // Fix trailing commas
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  // Fix height quotes (6'2")
  cleaned = cleaned.replace(
    /(\d)'(\d{1,2})"/g,
    (match, feet, inches, offset) => {
      const before = cleaned.substring(Math.max(0, offset - 50), offset);
      if (before.includes('": "') && !before.includes('",')) {
        return `${feet}'${inches} inches`;
      }
      return match;
    }
  );

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = JSON5.parse(cleaned);
  }

  // Handle escaped JSON strings
  for (const key of Object.keys(parsed)) {
    if (typeof parsed[key] === 'string' && parsed[key].startsWith('[')) {
      try {
        parsed[key] = JSON.parse(parsed[key]);
      } catch {
        // Keep as string
      }
    }
  }

  return schema.parse(parsed);
}

// ============================================
// ComicPlanner Class
// ============================================

export class ComicPlanner {
  // Haiku for simple tasks (characters, structure)
  private fastModel: ChatOpenAI;
  // Sonnet for complex tasks (panels, review)
  private smartModel: ChatOpenAI;

  constructor() {
    const baseConfig = {
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": "https://kitsumy.com",
          "X-Title": "Kitsumy Comic Planner"
        }
      },
      apiKey: process.env.OPENROUTER_API_KEY,
    };

    // Fast model for simple tasks (characters, structure)
    this.fastModel = new ChatOpenAI({
      ...baseConfig,
      modelName: "google/gemini-2.5-flash",
      temperature: 0.7,
    });

    // Smart model for complex tasks (panels, review)
    this.smartModel = new ChatOpenAI({
      ...baseConfig,
      modelName: "deepseek/deepseek-chat-v3-0324",
      temperature: 0.8,
    });
  }

  private generateId(): string {
    return Math.random().toString(36).slice(2, 11);
  }

  private requestCounter = 0;

  private async askForJSON<T>(
    model: ChatOpenAI,
    prompt: string,
    schema: z.ZodSchema<T>,
    logLabel?: string,
    maxRetries: number = 2
  ): Promise<T> {
    this.requestCounter++;
    const requestId = this.requestCounter;
    const modelName = model === this.fastModel ? 'Gemini-Flash' : 'DeepSeek-V3';
    const label = logLabel || 'request';

    const promptPreview = prompt.slice(0, 100).replace(/\n/g, ' ') + '...';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const attemptLabel = maxRetries > 1 && attempt > 1 ? ` (retry ${attempt}/${maxRetries})` : '';
      log(`[LLM #${requestId}] ${modelName} | ${label}${attemptLabel} | "${promptPreview}"`);

      const startTime = Date.now();

      try {
        const response = await model.invoke([
          new HumanMessage(prompt + "\n\nRespond with ONLY valid JSON, no explanations or markdown.")
        ]);

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        const content = response.content as string;
        const chars = content.length;

        log(`[LLM #${requestId}] ✓ ${duration}s | ~${chars} chars`);

        // Check if response looks like JSON (allow ```json blocks)
        let trimmed = content.trim();
        if (trimmed.startsWith('```')) {
          trimmed = trimmed.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
          const preview = trimmed.slice(0, 50).replace(/\n/g, ' ');
          throw new Error(`Response is not JSON: "${preview}..."`);
        }

        return parseJSON(content, schema);
      } catch (error: any) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        log(`[LLM #${requestId}] ✗ ${duration}s | Error: ${error.message}`);

        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          const delay = attempt * 1000;
          log(`[LLM #${requestId}] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }

    throw new Error('Max retries exceeded');
  }

  // ============================================
  // Main Method
  // ============================================

  async createPlan(request: ComicPlanRequest): Promise<ComicPlan> {
    const maxPages = Math.min(Math.max(1, request.maxPages || 5), 20);
    const language = request.language || 'uk';
    const visualStyle = request.style.visual;
    const worldSetting = request.style.setting || 'realistic';

    log(`[PLANNER] Starting: "${request.prompt}" (${maxPages} pages, ${visualStyle}/${worldSetting})`);

    // --- PHASE 1: Generate Characters (Fast Model) ---
    log(`[PLANNER] Phase 1: Characters (Gemini-Flash)...`);
    const characters = await this.generateCharacters(request.prompt, visualStyle, worldSetting);
    log(`[PLANNER] Created ${characters.length} characters`);

    // --- PHASE 2: Generate Structure (Fast Model) ---
    log(`[PLANNER] Phase 2: Structure (Gemini-Flash)...`);
    const structureResult = await this.generateStructure(request.prompt, characters, maxPages);
    log(`[PLANNER] Structure: ${structureResult.chapters.length} chapters, ${structureResult.chapters.reduce((sum, ch) => sum + ch.pages.length, 0)} pages`);

    // --- PHASE 3: Generate Panels with CoT (Smart Model) ---
    log(`[PLANNER] Phase 3: Panels with Chain-of-Thought (DeepSeek-V3)...`);
    const chapters = await this.generateAllPanels(
      request,
      characters,
      structureResult,
      maxPages,
      language,
      visualStyle,
      worldSetting
    );

    // --- PHASE 4: Self-Review (Smart Model) ---
    log(`[PLANNER] Phase 4: Self-Review (DeepSeek-V3)...`);
    const reviewedChapters = await this.selfReview(chapters, characters, language);

    const plan: ComicPlan = {
      id: this.generateId(),
      title: structureResult.title,
      style: request.style,
      characters: characters,
      chapters: reviewedChapters,
      createdAt: new Date().toISOString(),
    };

    const totalPanels = reviewedChapters.reduce((sum, ch) =>
      sum + ch.pages.reduce((pSum, p) => pSum + p.panels.length, 0), 0
    );
    log(`[PLANNER] Done: "${plan.title}" - ${chapters.reduce((sum, ch) => sum + ch.pages.length, 0)} pages, ${totalPanels} panels`);

    return plan;
  }

  // ============================================
  // Phase 1: Characters
  // ============================================

  private async generateCharacters(
    prompt: string,
    visualStyle: string,
    worldSetting: string
  ): Promise<ComicCharacter[]> {
    const characterPrompt = `Create 2-5 characters for a comic about: ${prompt}

VISUAL STYLE: ${visualStyle} (art style only)
WORLD SETTING: ${worldSetting}

Rules for "${worldSetting}" setting:
- "realistic": 100% realistic. NO sci-fi, NO fantasy. Historical accuracy required.
- "cyberpunk"/"sci-fi": Futuristic tech allowed.
- "fantasy": Magic allowed.
- "supernatural": Ghosts/vampires allowed.

IMPORTANT: Use ONLY plain text. NO special characters like quotes or double quotes inside values.

Return JSON:
{
  "characters": [
    {
      "name": "Full Name",
      "age": 34,
      "gender": "male" | "female" | "other",
      "bodyType": "slim" | "average" | "athletic" | "muscular" | "heavy" | "petite",
      "height": "182 cm" or "tall",
      "face": {
        "shape": "oval, square, round, heart, oblong",
        "eyes": "deep-set brown eyes with thick eyebrows",
        "nose": "straight Roman nose",
        "mouth": "thin lips, often pressed together",
        "hair": "short black hair, slicked back, graying at temples",
        "distinctiveFeatures": "scar on left cheek, stubble, crow feet"
      },
      "skinTone": "olive, pale, dark brown, tan, etc.",
      "defaultExpression": "neutral" | "happy" | "sad" | "angry" | "determined" | "worried" | "pensive",
      "clothing": "Outfit with colors and details",
      "role": "Role in story"
    }
  ]
}`;

    const characterResult = await this.askForJSON(
      this.fastModel,
      characterPrompt,
      characterSchema,
      'Characters'
    );

    return characterResult.characters.map((c, i) => ({
      id: `char-${i + 1}`,
      name: c.name,
      age: c.age,
      gender: c.gender as 'male' | 'female' | 'other',
      bodyType: c.bodyType as BodyType,
      height: c.height,
      face: c.face,
      skinTone: c.skinTone,
      defaultExpression: c.defaultExpression as FacialExpression,
      clothing: c.clothing,
      role: c.role,
      seed: Math.floor(Math.random() * 1000000),
    }));
  }

  // ============================================
  // Phase 2: Structure
  // ============================================

  private async generateStructure(
    prompt: string,
    characters: ComicCharacter[],
    maxPages: number
  ) {
    const charactersDescription = characters
      .map(c => `- ${c.name} (${c.id}): ${c.role}`)
      .join('\n');

    const chaptersCount = maxPages <= 3 ? 1 : maxPages <= 10 ? 2 : Math.min(4, Math.ceil(maxPages / 5));

    return await this.askForJSON(
      this.fastModel,
      `Create story structure for: ${prompt}

MAIN CHARACTERS (use these IDs):
${charactersDescription}

REQUIREMENTS:
- Exactly ${chaptersCount} chapter(s)
- EXACTLY ${maxPages} total pages
- Each page needs a scene with location, weather, timeOfDay, atmosphere
- Make each page summary SPECIFIC and UNIQUE - avoid generic descriptions

AVAILABLE LAYOUTS (choose based on panel dimensions):
- 'single': 1 large panel (4:5 aspect) - full-page splash, establishing shots, dramatic moments
- 'two-horizontal': 2 wide panels stacked (4:2.5 each) - dialogue exchanges, before/after, parallel events
- 'two-vertical': 2 tall columns side by side (2:5 each) - vertical action, tall characters, parallel POVs
- 'three-rows': 3 horizontal strips (4:1.6 each) - sequential action, time progression, montage
- 'grid-2x2': 4 equal panels (2:2.5 each) - conversations, multi-angle shots, quick sequence
- 'big-left': 1 large left (2.6:5) + 2 smaller right (1.3:2.5 each) - main action with reactions
- 'big-right': 2 smaller left (1.3:2.5 each) + 1 large right (2.6:5) - build-up to reveal
- 'big-top': 1 wide top (4:3.3) + 2 smaller bottom (2:1.6 each) - establishing + details
- 'big-bottom': 2 smaller top (2:1.6 each) + 1 wide bottom (4:3.3) - details leading to climax
- 'strip-3': 3 tall vertical columns (1.3:5 each) - vertical movement, tall scenes, manga style
- 'manga-3': 1 top (4:2.5) + 2 bottom columns (2:2.5 each) - intro + dual reactions
- 'action': 1 large left (2.6:3.7) + 2 stacked right (1.3:1.9 each) - dynamic action sequences

LAYOUT SELECTION TIPS:
- Wide panels (two-horizontal, big-top, big-bottom) = landscapes, crowds, horizontal movement
- Tall panels (two-vertical, strip-3) = standing figures, vertical action, falling, towers
- Big + small combos (big-left/right/top/bottom) = main focus with supporting details
- Grid (grid-2x2, action) = fast pacing, multiple perspectives

IMPORTANT - charactersInScene:
- List ONLY characters who ACTUALLY APPEAR in this scene
- Use main character IDs (char-1, char-2, etc.) for main characters
- For EPISODIC/BACKGROUND characters NOT in the main list, use descriptive IDs like:
  - "anon-editor" (newspaper editor)
  - "anon-fence" (black market dealer)
  - "anon-soldier" (random soldier)
  - "anon-crowd" (background crowd)
- If scene has ONLY anonymous characters, don't force main characters into it

Return JSON:
{
  "title": "Comic Title",
  "chapters": [
    {
      "title": "Chapter Title",
      "pages": [
        {
          "layout": "layout-name",
          "summary": "SPECIFIC events: who does what, key dialogue moment, emotional beat",
          "charactersInScene": ["char-1", "anon-editor"],
          "scene": {
            "location": "Normandy beach, France",
            "weather": "overcast, light rain",
            "timeOfDay": "dawn"
          }
        }
      ]
    }
  ]
}`,
      structureSchema,
      'Structure'
    );
  }

  // ============================================
  // Phase 3: Panels with Chain-of-Thought (PARALLEL)
  // ============================================

  private async generateAllPanels(
    request: ComicPlanRequest,
    characters: ComicCharacter[],
    structureResult: z.infer<typeof structureSchema>,
    maxPages: number,
    language: string,
    visualStyle: string,
    worldSetting: string
  ): Promise<ComicChapter[]> {
    // Збираємо всі сторінки з глобальним контекстом
    const allPagePlans: Array<{
      chIdx: number;
      pIdx: number;
      globalPageNumber: number;
      pagePlan: z.infer<typeof structureSchema>['chapters'][0]['pages'][0];
      chapterTitle: string;
    }> = [];

    let globalPageNumber = 0;
    for (let chIdx = 0; chIdx < structureResult.chapters.length; chIdx++) {
      const chapter = structureResult.chapters[chIdx];
      for (let pIdx = 0; pIdx < chapter.pages.length; pIdx++) {
        if (globalPageNumber >= maxPages) break;
        globalPageNumber++;
        allPagePlans.push({
          chIdx,
          pIdx,
          globalPageNumber,
          pagePlan: chapter.pages[pIdx],
          chapterTitle: chapter.title,
        });
      }
      if (globalPageNumber >= maxPages) break;
    }

    // Будуємо глобальний контекст з Phase 2 (всі page summaries)
    const allSummaries = allPagePlans.map((p, i) =>
      `Page ${i + 1}: ${p.pagePlan.summary}`
    ).join('\n');

    log(`[PLANNER] Generating ${allPagePlans.length} pages in PARALLEL...`);

    // Генеруємо всі сторінки паралельно
    const pageResults = await Promise.all(
      allPagePlans.map(async (pageMeta) => {
        const { chIdx, pIdx, globalPageNumber, pagePlan, chapterTitle } = pageMeta;
        const layout = pagePlan.layout as PageLayout;
        const panelCount = LAYOUT_PANEL_COUNT[layout];
        const scene = pagePlan.scene;
        const charactersInScene = pagePlan.charactersInScene || [];

        log(`[PLANNER] Page ${globalPageNumber}: ${layout} (${panelCount} panels) [${charactersInScene.join(', ')}]`);

        // Step 3a: Chain-of-Thought з глобальним контекстом
        log(`[PLANNER]   └─ Thinking...`);
        const thinking = await this.thinkAboutPageParallel(
          request.prompt,
          pagePlan.summary,
          panelCount,
          allSummaries,
          globalPageNumber,
          characters,
          charactersInScene,
          language
        );

        // Step 3b: Генеруємо всі панелі сторінки паралельно
        log(`[PLANNER]   └─ Generating ${panelCount} panels...`);
        const panelPromises = Array.from({ length: panelCount }, (_, panelIdx) =>
          this.generateSinglePanelParallel(
            request.prompt,
            visualStyle,
            worldSetting,
            scene,
            pagePlan.summary,
            thinking,
            panelIdx,
            panelCount,
            characters,
            charactersInScene,
            language,
            chIdx,
            pIdx,
            layout
          )
        );

        const panels = await Promise.all(panelPromises);

        const pageScene: PageScene = {
          location: scene.location,
          weather: scene.weather,
          timeOfDay: scene.timeOfDay,
        };

        return {
          chIdx,
          pIdx,
          chapterTitle,
          page: {
            id: `ch${chIdx + 1}-p${pIdx + 1}`,
            pageNumber: globalPageNumber,
            layout: layout,
            scene: pageScene,
            summary: pagePlan.summary,
            charactersInScene: charactersInScene,
            panels: panels,
          } as ComicPage,
        };
      })
    );

    // Збираємо результати в chapters
    const chaptersMap = new Map<number, { title: string; pages: ComicPage[] }>();

    for (const result of pageResults) {
      if (!chaptersMap.has(result.chIdx)) {
        chaptersMap.set(result.chIdx, { title: result.chapterTitle, pages: [] });
      }
      chaptersMap.get(result.chIdx)!.pages.push(result.page);
    }

    // Сортуємо сторінки за pageNumber і формуємо chapters
    const chapters: ComicChapter[] = [];
    const sortedChapterIndices = Array.from(chaptersMap.keys()).sort((a, b) => a - b);

    for (const chIdx of sortedChapterIndices) {
      const chapterData = chaptersMap.get(chIdx)!;
      chapterData.pages.sort((a, b) => a.pageNumber - b.pageNumber);
      chapters.push({
        id: `ch${chIdx + 1}`,
        title: chapterData.title,
        pages: chapterData.pages,
      });
    }

    return chapters;
  }

  // Chain-of-Thought для паралельної генерації (використовує глобальний контекст)
  private async thinkAboutPageParallel(
    storyPrompt: string,
    pageSummary: string,
    panelCount: number,
    allSummaries: string,
    currentPageNumber: number,
    characters: ComicCharacter[],
    charactersInScene: string[],
    language: string
  ): Promise<z.infer<typeof pageThinkingSchema>> {
    const langNote = language === 'uk' ? 'Think in context of Ukrainian comic.' : 'Think in context of English comic.';

    // Розділяємо на головних та анонімних
    const mainCharIds = charactersInScene.filter(id => id.startsWith('char-'));
    const anonCharIds = charactersInScene.filter(id => id.startsWith('anon-'));

    const mainCharsInScene = characters.filter(c => mainCharIds.includes(c.id));
    const mainCharsDescription = mainCharsInScene.length > 0
      ? `MAIN CHARACTERS IN THIS SCENE: ${mainCharsInScene.map(c => `${c.id}: ${c.name}`).join(', ')}`
      : 'NO MAIN CHARACTERS in this scene';

    const anonCharsDescription = anonCharIds.length > 0
      ? `ANONYMOUS/EPISODIC CHARACTERS: ${anonCharIds.join(', ')}`
      : '';

    return await this.askForJSON(
      this.smartModel,
      `You are a comic book director. Before creating panels, THINK about this page.

STORY: ${storyPrompt}

FULL STORY STRUCTURE (all pages):
${allSummaries}

YOU ARE WORKING ON PAGE ${currentPageNumber}: ${pageSummary}

PANEL COUNT: ${panelCount}
${mainCharsDescription}
${anonCharsDescription}

IMPORTANT: Only use characters listed above. Do NOT add other main characters.

${langNote}

Analyze and return your thinking:
{
  "storyBeats": ["beat 1", "beat 2", "..."],  // Key story moments for this page
  "emotionalArc": "Description of emotional journey on this page",
  "keyMoments": ["moment 1", "moment 2"],  // Most important visual moments
  "panelBreakdown": [
    {
      "panelNumber": 1,
      "purpose": "Why this panel exists, what it shows",
      "suggestedShot": "wide/medium/close-up/etc",
      "suggestedAngle": "eye-level/low-angle/etc"
    }
  ]
}`,
      pageThinkingSchema,
      `PageThinking P${currentPageNumber}`
    );
  }

  // Генерація панелі для паралельного режиму
  private async generateSinglePanelParallel(
    storyPrompt: string,
    visualStyle: string,
    worldSetting: string,
    scene: { location: string; weather?: string; timeOfDay?: string; atmosphere?: string },
    pageSummary: string,
    thinking: z.infer<typeof pageThinkingSchema>,
    panelIndex: number,
    totalPanels: number,
    characters: ComicCharacter[],
    charactersInScene: string[],
    language: string,
    chIdx: number,
    pIdx: number,
    layout: PageLayout
  ): Promise<PanelPlan> {
    // Get aspect ratio from layout slots
    const slots = LAYOUT_SLOTS[layout];
    const slot = slots.find(s => s.position === panelIndex + 1);
    const aspectRatio: AspectRatio = slot?.aspectRatio || '1:1';
    // Розділяємо на головних та анонімних
    const mainCharIds = charactersInScene.filter(id => id.startsWith('char-'));
    const anonCharIds = charactersInScene.filter(id => id.startsWith('anon-'));

    // Всі допустимі ID (головні + анонімні)
    const allValidIds = new Set([...mainCharIds, ...anonCharIds]);
    const mainCharsInScene = characters.filter(c => mainCharIds.includes(c.id));

    const contentLanguage = language === 'uk'
      ? 'Write ALL text in Ukrainian. Не змішуй мови.'
      : 'Write ALL text in English. Do not mix languages.';

    const fewShotExample = language === 'uk' ? FEW_SHOT_PANEL_EXAMPLE_UK : FEW_SHOT_PANEL_EXAMPLE_EN;

    const panelThinking = thinking.panelBreakdown[panelIndex] || {
      purpose: 'Continue the story',
      suggestedShot: 'medium',
      suggestedAngle: 'eye-level'
    };

    // Контекст інших панелей з Chain-of-Thought
    const otherPanelsContext = thinking.panelBreakdown
      .filter((_, i) => i !== panelIndex)
      .map(p => `Panel ${p.panelNumber}: ${p.purpose}`)
      .join('\n');

    // Опис персонажів для цієї сцени
    let charactersSection = '';
    if (mainCharsInScene.length > 0) {
      charactersSection += `MAIN CHARACTERS IN THIS SCENE (use these IDs):\n`;
      charactersSection += mainCharsInScene.map(c =>
        `- ${c.id}: ${c.name} - ${c.role}. ${c.face.hair}, ${c.face.eyes}, ${c.skinTone} skin.`
      ).join('\n');
    }
    if (anonCharIds.length > 0) {
      charactersSection += `\n\nANONYMOUS CHARACTERS (use these IDs for episodic characters):\n`;
      charactersSection += anonCharIds.map(id => `- ${id}`).join('\n');
    }
    if (charactersSection === '') {
      charactersSection = 'NO CHARACTERS in this panel (environment/establishing shot)';
    }

    const validIdsString = [...mainCharIds, ...anonCharIds].join(', ') || 'none';

    // Get style prompts for image generation
    const stylePrompts = getStylePrompts(visualStyle);
    const settingPrompt = getSettingPrompt(worldSetting);

    // Build detailed character descriptions for imagePrompt
    const charDescriptionsForImage = mainCharsInScene.map(c =>
      `${c.id}: ${c.age} year old ${c.gender}, ${c.bodyType} ${c.height}, ${c.skinTone} skin, ${c.face.hair}, ${c.face.eyes}, ${c.face.distinctiveFeatures}, wearing ${c.clothing}`
    ).join('\n');

    const result = await this.askForJSON(
      this.smartModel,
      `Generate panel ${panelIndex + 1} of ${totalPanels} for a comic page.

STORY: ${storyPrompt}
VISUAL STYLE: ${visualStyle}
SETTING: ${worldSetting}
PAGE SUMMARY: ${pageSummary}
SCENE: ${scene.location}${scene.weather ? `, ${scene.weather}` : ''}${scene.timeOfDay ? `, ${scene.timeOfDay}` : ''}

OTHER PANELS ON THIS PAGE (for context, avoid repetition):
${otherPanelsContext}

YOUR THINKING FOR THIS PANEL:
- Purpose: ${panelThinking.purpose}
- Suggested shot: ${panelThinking.suggestedShot}
- Suggested angle: ${panelThinking.suggestedAngle}
- Emotional arc: ${thinking.emotionalArc}

${charactersSection}

DETAILED CHARACTER APPEARANCES (for imagePrompt):
${charDescriptionsForImage || 'No main characters - use generic descriptions for anonymous characters'}

CRITICAL RULES:
1. ${contentLanguage} This includes action, dialogue, narrative, sfx, gesture, and gazeDirection fields.
2. This panel MUST be UNIQUE - different from all other panels.
3. Action description must be SPECIFIC and VISUAL (what camera sees).
4. Use ONLY valid character IDs from this scene: ${validIdsString}
5. Do NOT add characters who are not in this scene (e.g., don't add char-3 if they're not listed above).
6. Follow your thinking: use suggested shot "${panelThinking.suggestedShot}" and angle "${panelThinking.suggestedAngle}".

IMAGE PROMPT RULES (for Flux image generation - CRITICAL FOR CONSISTENCY):
7. "imagePrompt" must be in ENGLISH only (even if content is Ukrainian)
8. START the prompt with: "${stylePrompts.prefix}"
9. Then include: camera shot, angle, character appearances (EXACT physical details from DETAILED CHARACTER APPEARANCES), poses, expressions, location, atmosphere
10. END the prompt with: "${stylePrompts.suffix}"${settingPrompt ? `, ${settingPrompt}` : ''}
11. "negativePrompt" MUST include: "realistic photo, photorealistic, 3D render, photograph, blurry, text, speech bubbles, watermark"

COMPOSITION RULES FOR TEXT PLACEMENT (CRITICAL - Flux must leave empty areas):
12. For CLOSE-UP shots: Add "negative space in corner for text, face positioned off-center" to imagePrompt
13. For PORTRAIT shots: Add "composition with empty sky/background area for dialogue" to imagePrompt
14. For any shot with dialogue: Include "asymmetrical composition leaving room for speech bubbles" in imagePrompt
15. NEVER generate images where the subject fills the ENTIRE frame - always leave breathing room in at least one corner

IMPORTANT: All panels MUST look like they're from the SAME comic book. Use consistent style keywords!

${fewShotExample}

SHOT TYPES: extreme-close-up, close-up, medium-close-up, medium, medium-wide, wide, extreme-wide
CAMERA ANGLES: eye-level, low-angle, high-angle, dutch-angle, birds-eye, worms-eye, over-the-shoulder

TEXT PLACEMENT (9-zone grid):
┌───────────┬───────────┬───────────┐
│ top-left  │top-center │ top-right │
├───────────┼───────────┼───────────┤
│middle-left│mid-center │middle-right│
├───────────┼───────────┼───────────┤
│bottom-left│bot-center │bottom-right│
└───────────┴───────────┴───────────┘
- Place dialogue near speaking character when visible
- Avoid placing text where it would cover faces/action
- Narrative boxes typically go in corners (top-left preferred)
- Each dialogue needs unique placement (no overlaps)

Return ONLY the panel JSON (no wrapper object):
{
  "characters": [...],
  "action": "...",
  "mood": "...",
  "camera": { "shot": "...", "angle": "...", "focus": "..." },
  "dialogue": [{ "characterId": "char-1", "text": "...", "placement": "top-left" }],
  "narrative": "..." or null,
  "narrativePlacement": "top-left" or null,
  "sfx": "..." or null,
  "imagePrompt": "detailed prompt for Flux in English...",
  "negativePrompt": "blurry, low quality, text, watermark, speech bubbles"
}`,
      singlePanelSchema,
      `Panel ${panelIndex + 1}/${totalPanels}`
    );

    // Normalize and validate
    const rawFocus = result.camera.focus;
    const normalizedFocus = Array.isArray(rawFocus) ? rawFocus[0] : rawFocus;

    // Handle null/undefined arrays
    const charactersArray = result.characters || [];
    const dialogueArray = result.dialogue || [];

    // Фільтруємо персонажів — тільки ті, що в цій сцені
    const validCharacters = charactersArray.filter(c => {
      if (!allValidIds.has(c.characterId)) {
        log(`[PLANNER] Warning: Character "${c.characterId}" not in scene [${validIdsString}], removing`);
        return false;
      }
      return true;
    });

    const validDialogue = dialogueArray.filter(d => {
      if (!allValidIds.has(d.characterId)) {
        log(`[PLANNER] Warning: Dialogue character "${d.characterId}" not in scene, removing`);
        return false;
      }
      return true;
    });

    // Build characterSeeds map for main characters in this panel
    const characterSeeds: Record<string, number> = {};
    for (const charInPanel of validCharacters) {
      const mainChar = characters.find(c => c.id === charInPanel.characterId);
      if (mainChar?.seed) {
        characterSeeds[mainChar.id] = mainChar.seed;
      }
    }

    // Convert dialogue with placement
    const dialogueWithPlacement: PanelDialogue[] = validDialogue.map(d => ({
      characterId: d.characterId,
      text: d.text,
      placement: d.placement || undefined,
    }));

    return {
      id: `ch${chIdx + 1}-p${pIdx + 1}-pan${panelIndex + 1}`,
      position: panelIndex + 1,
      characters: validCharacters as CharacterInPanel[],
      action: result.action,
      mood: result.mood,
      camera: {
        shot: result.camera.shot,
        angle: result.camera.angle,
        focus: normalizedFocus || undefined,
      },
      dialogue: dialogueWithPlacement,
      narrative: result.narrative ?? null,
      narrativePlacement: result.narrativePlacement || undefined,
      sfx: result.sfx ?? null,
      aspectRatio: aspectRatio,
      imagePrompt: result.imagePrompt,
      negativePrompt: result.negativePrompt || undefined,
      characterSeeds: Object.keys(characterSeeds).length > 0 ? characterSeeds : undefined,
    };
  }

  // ============================================
  // Phase 4: Self-Review
  // ============================================

  private async selfReview(
    inputChapters: ComicChapter[],
    characters: ComicCharacter[],
    language: string,
    passNumber: number = 1
  ): Promise<ComicChapter[]> {
    let chapters = inputChapters;
    // Збираємо всі панелі для review
    const allPanels: { chapterIdx: number; pageIdx: number; panelIdx: number; panel: PanelPlan }[] = [];

    for (let chIdx = 0; chIdx < chapters.length; chIdx++) {
      for (let pIdx = 0; pIdx < chapters[chIdx].pages.length; pIdx++) {
        for (let panIdx = 0; panIdx < chapters[chIdx].pages[pIdx].panels.length; panIdx++) {
          allPanels.push({
            chapterIdx: chIdx,
            pageIdx: pIdx,
            panelIdx: panIdx,
            panel: chapters[chIdx].pages[pIdx].panels[panIdx],
          });
        }
      }
    }

    // Якщо мало панелей - не робимо review
    if (allPanels.length < 5) {
      log(`[PLANNER] Skipping review (only ${allPanels.length} panels)`);
      return chapters;
    }

    // Збираємо інформацію про персонажів у кожній сцені
    const pageCharactersMap = new Map<string, string[]>();
    for (let chIdx = 0; chIdx < chapters.length; chIdx++) {
      for (let pIdx = 0; pIdx < chapters[chIdx].pages.length; pIdx++) {
        const page = chapters[chIdx].pages[pIdx];
        const pageId = `ch${chIdx + 1}-p${pIdx + 1}`;
        pageCharactersMap.set(pageId, page.charactersInScene || []);
      }
    }

    const panelsSummary = allPanels.map(p => {
      const pageId = p.panel.id.replace(/-pan\d+$/, '');
      const allowedChars = pageCharactersMap.get(pageId) || [];
      const usedChars = p.panel.characters.map(c => c.characterId);
      return `${p.panel.id} (allowed: ${allowedChars.join(',') || 'none'}): "${p.panel.action}" | chars: ${usedChars.join(',') || 'none'} | dialogue: ${p.panel.dialogue.map(d => d.text).join('; ') || 'none'}`;
    }).join('\n');

    const validIds = characters.map(c => c.id);
    const langName = language === 'uk' ? 'Ukrainian' : 'English';

    try {
      const review = await this.askForJSON(
        this.smartModel,
        `Review these comic panels for quality issues.

LANGUAGE REQUIREMENT: All text must be in ${langName}.
MAIN CHARACTER IDs: ${validIds.join(', ')}
(Anonymous characters use "anon-*" IDs like anon-editor, anon-soldier, etc.)

PANELS (format: panelId (allowed characters): action | chars: used | dialogue):
${panelsSummary}

Find issues:
1. REPETITION: Similar actions or dialogue across panels
2. LANGUAGE: Text not in ${langName} or mixed languages
3. CONTINUITY: Story doesn't flow logically
4. CHARACTER: Invalid character IDs (not char-* or anon-*)
5. SCENE-MISMATCH: Panel uses characters NOT in the "allowed" list for that page

Return JSON:
{
  "issues": [
    {
      "panelId": "ch1-p1-pan1",
      "type": "repetition" | "language" | "continuity" | "character" | "scene-mismatch" | "other",
      "description": "What's wrong",
      "fix": "How to fix it"
    }
  ],
  "overallQuality": "good" | "needs_fixes" | "poor"
}

If no issues found, return empty issues array with "good" quality.`,
        reviewSchema,
        'SelfReview'
      );

      const passLabel = passNumber > 1 ? ` (pass ${passNumber})` : '';
      log(`[PLANNER] Review${passLabel}: ${review.overallQuality}, ${review.issues.length} issues found`);

      // Логуємо знайдені проблеми
      for (const issue of review.issues) {
        log(`[PLANNER]   └─ ${issue.panelId}: [${issue.type}] ${issue.description}`);
      }

      // Автоматично виправляємо проблеми
      if (review.issues.length > 0) {
        log(`[PLANNER] Applying fixes...`);
        chapters = await this.applyFixes(chapters, review.issues, characters, language);

        // Second pass review (only if first pass had issues and we haven't done it yet)
        if (passNumber === 1) {
          log(`[PLANNER] Phase 4b: Second Review Pass...`);
          chapters = await this.selfReview(chapters, characters, language, 2);
        }
      }

    } catch (err) {
      log(`[PLANNER] Review failed: ${err}`);
    }

    return chapters;
  }

  // ============================================
  // Phase 4b: Apply Fixes
  // ============================================

  private async applyFixes(
    chapters: ComicChapter[],
    issues: Array<{ panelId: string; type: string; description: string; fix: string }>,
    characters: ComicCharacter[],
    language: string
  ): Promise<ComicChapter[]> {
    const validCharacterIds = characters.map(c => c.id).join(', ');
    const langName = language === 'uk' ? 'Ukrainian' : 'English';
    const fewShotExample = language === 'uk' ? FEW_SHOT_PANEL_EXAMPLE_UK : FEW_SHOT_PANEL_EXAMPLE_EN;

    // Групуємо issues по панелях
    const issuesByPanel = new Map<string, typeof issues>();
    for (const issue of issues) {
      const existing = issuesByPanel.get(issue.panelId) || [];
      existing.push(issue);
      issuesByPanel.set(issue.panelId, existing);
    }

    // Знаходимо і виправляємо всі панелі ПАРАЛЕЛЬНО
    log(`[PLANNER] Fixing ${issuesByPanel.size} panels in PARALLEL...`);

    const fixPromises = Array.from(issuesByPanel.entries()).map(async ([panelId, panelIssues]) => {
      // Парсимо ID: ch1-p1-pan1
      const match = panelId.match(/ch(\d+)-p(\d+)-pan(\d+)/);
      if (!match) {
        log(`[PLANNER]   └─ Cannot parse panelId: ${panelId}`);
        return null;
      }

      const chIdx = parseInt(match[1]) - 1;
      const pIdx = parseInt(match[2]) - 1;
      const panIdx = parseInt(match[3]) - 1;

      // Перевіряємо чи існує
      if (!chapters[chIdx]?.pages[pIdx]?.panels[panIdx]) {
        log(`[PLANNER]   └─ Panel not found: ${panelId}`);
        return null;
      }

      const currentPanel = chapters[chIdx].pages[pIdx].panels[panIdx];
      const page = chapters[chIdx].pages[pIdx];

      log(`[PLANNER]   └─ Fixing ${panelId}...`);

      // Формуємо опис проблем
      const issuesDescription = panelIssues
        .map(i => `- [${i.type}] ${i.description} → Fix: ${i.fix}`)
        .join('\n');

      try {
        const fixedPanel = await this.askForJSON(
          this.smartModel,
          `Fix this comic panel based on review feedback.

CURRENT PANEL:
${JSON.stringify(currentPanel, null, 2)}

SCENE: ${page.scene.location}${page.scene.weather ? `, ${page.scene.weather}` : ''}${page.scene.timeOfDay ? `, ${page.scene.timeOfDay}` : ''}

ISSUES TO FIX:
${issuesDescription}

CHARACTERS (use ONLY these IDs: ${validCharacterIds}):
${characters.map(c => `- ${c.id}: ${c.name}`).join('\n')}

CRITICAL RULES:
1. ALL text (action, dialogue, narrative, sfx, gesture, gazeDirection) MUST be in ${langName}
2. Keep the same panel position and general idea
3. Fix ONLY the issues mentioned above
4. Use ONLY valid character IDs: ${validCharacterIds}
5. gesture and gazeDirection fields MUST also be in ${langName}

${fewShotExample}

Return the FIXED panel JSON:`,
          singlePanelSchema,
          `Fix ${panelId}`
        );

        log(`[PLANNER]   └─ Fixed ${panelId} ✓`);

        return {
          chIdx,
          pIdx,
          panIdx,
          panelId,
          currentPanel,
          fixedPanel,
        };
      } catch (err) {
        log(`[PLANNER]   └─ Failed to fix ${panelId}: ${err}`);
        return null;
      }
    });

    // Чекаємо на всі паралельні фікси
    const fixResults = await Promise.all(fixPromises);

    // Застосовуємо результати
    const validIds = new Set(characters.map(c => c.id));
    for (const result of fixResults) {
      if (!result) continue;

      const { chIdx, pIdx, panIdx, panelId, currentPanel, fixedPanel } = result;
      const charactersArray = fixedPanel.characters || [];
      const dialogueArray = fixedPanel.dialogue || [];

      chapters[chIdx].pages[pIdx].panels[panIdx] = {
        id: panelId,
        position: currentPanel.position,
        characters: charactersArray.filter(c => validIds.has(c.characterId)) as CharacterInPanel[],
        action: fixedPanel.action,
        mood: fixedPanel.mood,
        camera: {
          shot: fixedPanel.camera.shot,
          angle: fixedPanel.camera.angle,
          focus: Array.isArray(fixedPanel.camera.focus) ? fixedPanel.camera.focus[0] : fixedPanel.camera.focus || undefined,
        },
        dialogue: dialogueArray.filter(d => validIds.has(d.characterId)) as PanelDialogue[],
        narrative: fixedPanel.narrative ?? null,
        sfx: fixedPanel.sfx ?? null,
        // Preserve aspectRatio from original (layout-based)
        aspectRatio: currentPanel.aspectRatio,
        // Preserve imagePrompt from fix or fallback to original
        imagePrompt: fixedPanel.imagePrompt || currentPanel.imagePrompt,
        negativePrompt: fixedPanel.negativePrompt || currentPanel.negativePrompt,
        // Preserve characterSeeds from original
        characterSeeds: currentPanel.characterSeeds,
      };
    }

    return chapters;
  }
}
