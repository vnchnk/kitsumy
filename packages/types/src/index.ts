export enum AppMode {
  LEARNING = 'learning',
  CREATIVE = 'creative',
  THERAPY = 'therapy',
}

// Доступні стилі коміксів
export type ComicStyle =
  | 'american-classic'  // Marvel/DC style
  | 'noir'              // Sin City style
  | 'manga'             // Japanese manga
  | 'euro-bd'           // European Bande Dessinée (Tintin, Moebius)
  | 'watercolor'        // Painted watercolor
  | 'retro'             // Vintage 50s-60s
  | 'cyberpunk'         // Sci-fi neon
  | 'whimsical'         // Children's book
  | 'horror'            // Dark fantasy
  | 'minimalist'        // Modern minimal
  | 'ukiyo-e'           // Japanese woodblock print
  | 'pop-art'           // Lichtenstein style
  | 'sketch'            // Pencil storyboard
  | 'cel-shaded'        // Borderlands/Spider-Verse
  | 'pulp'              // 1930s-40s pulp fiction
  | 'woodcut'           // Medieval woodcut print
  | 'art-nouveau'       // Alphonse Mucha style
  | 'graffiti'          // Street art / spray paint
  | 'chibi'             // Super-deformed cute
  | 'soviet-poster';    // Soviet propaganda poster

export const COMIC_STYLE_NAMES: Record<ComicStyle, string> = {
  'american-classic': 'American Classic',
  'noir': 'Noir',
  'manga': 'Manga',
  'euro-bd': 'European BD',
  'watercolor': 'Watercolor',
  'retro': 'Retro Vintage',
  'cyberpunk': 'Cyberpunk',
  'whimsical': 'Whimsical',
  'horror': 'Horror',
  'minimalist': 'Minimalist',
  'ukiyo-e': 'Ukiyo-e',
  'pop-art': 'Pop Art',
  'sketch': 'Sketch',
  'cel-shaded': 'Cel-Shaded',
  'pulp': 'Pulp Fiction',
  'woodcut': 'Woodcut',
  'art-nouveau': 'Art Nouveau',
  'graffiti': 'Graffiti',
  'chibi': 'Chibi',
  'soviet-poster': 'Soviet Poster'
};

// Промпти для Flux image generation
// prefix - на початку промпту, suffix - в кінці (Flux краще сприймає стиль на початку і в кінці)
export interface StylePrompt {
  prefix: string;
  suffix: string;
}

export const COMIC_STYLE_PROMPTS: Record<ComicStyle, StylePrompt> = {
  'american-classic': {
    prefix: 'comic book panel illustration, professional comic art,',
    suffix: 'Marvel DC comic book style, bold ink lines, dynamic composition, vibrant saturated colors, halftone dots texture, classic American comic aesthetic'
  },
  'noir': {
    prefix: 'noir comic book panel, high contrast black and white illustration,',
    suffix: 'Frank Miller Sin City style, dramatic chiaroscuro lighting, deep shadows, stark contrasts, noir comic art'
  },
  'manga': {
    prefix: 'manga panel illustration, Japanese comic art style,',
    suffix: 'clean manga linework, expressive anime eyes, screentone shading, dynamic speed lines, professional manga aesthetic'
  },
  'euro-bd': {
    prefix: 'European bande dessinée panel, ligne claire illustration,',
    suffix: 'Tintin Moebius inspired, clean precise lines, detailed backgrounds, European comic book style'
  },
  'watercolor': {
    prefix: 'watercolor comic panel, painted illustration style,',
    suffix: 'soft watercolor washes, flowing colors, painterly comic art, artistic brushwork'
  },
  'retro': {
    prefix: 'vintage 1950s comic panel, retro illustration,',
    suffix: 'classic Americana style, warm nostalgic palette, vintage comic book aesthetic'
  },
  'cyberpunk': {
    prefix: 'cyberpunk comic panel, neon-lit sci-fi illustration,',
    suffix: 'futuristic cyberpunk style, neon glows, high tech aesthetic, dystopian atmosphere'
  },
  'whimsical': {
    prefix: 'children book illustration panel, whimsical art style,',
    suffix: 'soft friendly colors, storybook illustration, charming whimsical aesthetic'
  },
  'horror': {
    prefix: 'horror comic panel, dark gothic illustration,',
    suffix: 'eerie atmosphere, creepy details, dark fantasy horror comic style'
  },
  'minimalist': {
    prefix: 'minimalist comic panel, clean simple illustration,',
    suffix: 'limited color palette, negative space, modern minimalist comic design'
  },
  'ukiyo-e': {
    prefix: 'ukiyo-e style panel, Japanese woodblock print illustration,',
    suffix: 'flat colors, bold outlines, traditional Japanese art aesthetic'
  },
  'pop-art': {
    prefix: 'pop art comic panel, Lichtenstein style illustration,',
    suffix: 'Ben-Day dots, bold primary colors, pop art comic aesthetic'
  },
  'sketch': {
    prefix: 'pencil sketch comic panel, storyboard style illustration,',
    suffix: 'rough pencil lines, crosshatching, hand-drawn sketch aesthetic'
  },
  'cel-shaded': {
    prefix: 'cel-shaded comic panel, 3D comic style illustration,',
    suffix: 'Borderlands Spider-Verse style, bold outlines, flat cel shading'
  },
  'pulp': {
    prefix: '1930s pulp fiction comic panel, vintage adventure illustration,',
    suffix: 'dramatic pulp art lighting, action-packed, classic pulp aesthetic'
  },
  'woodcut': {
    prefix: 'woodcut print style panel, medieval illustration,',
    suffix: 'bold black lines, textured woodcut print aesthetic'
  },
  'art-nouveau': {
    prefix: 'art nouveau style panel, Alphonse Mucha inspired illustration,',
    suffix: 'decorative borders, flowing organic lines, art nouveau aesthetic'
  },
  'graffiti': {
    prefix: 'street art comic panel, graffiti style illustration,',
    suffix: 'spray paint aesthetic, urban bold colors, edgy street art style'
  },
  'chibi': {
    prefix: 'chibi style comic panel, super-deformed cute illustration,',
    suffix: 'big heads small bodies, kawaii chibi aesthetic'
  },
  'soviet-poster': {
    prefix: 'Soviet propaganda poster style panel, constructivist illustration,',
    suffix: 'bold red and black, heroic poses, Soviet poster aesthetic'
  },
};

// ============================================
// Comic Planner Types
// ============================================

// Візуальний стиль (як малювати)
export type ComicVisualStyle = ComicStyle;

// Доступні темплейти сторінок (з TemplatesPanel.tsx)
export type PageLayout =
  | 'single'           // 1 панель
  | 'two-horizontal'   // 2 панелі вертикально
  | 'two-vertical'     // 2 панелі горизонтально
  | 'three-rows'       // 3 ряди
  | 'grid-2x2'         // 4 панелі 2x2
  | 'big-left'         // велика зліва + 2 маленькі
  | 'big-right'        // 2 маленькі + велика справа
  | 'big-top'          // велика зверху + 2 внизу
  | 'big-bottom'       // 2 зверху + велика внизу
  | 'strip-3'          // 3 колонки
  | 'manga-3'          // манга стиль
  | 'action';          // 5 панелей екшен

// Кількість панелей для кожного темплейту
export const LAYOUT_PANEL_COUNT: Record<PageLayout, number> = {
  'single': 1,
  'two-horizontal': 2,
  'two-vertical': 2,
  'three-rows': 3,
  'grid-2x2': 4,
  'big-left': 3,
  'big-right': 3,
  'big-top': 3,
  'big-bottom': 3,
  'strip-3': 3,
  'manga-3': 3,
  'action': 5,
};

// Aspect ratio для Flux
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '2:1' | '1:2' | '3:2' | '2:3';

// Розмір слота (для пріоритету генерації)
export type SlotSize = 'small' | 'medium' | 'large';

// Опис слота панелі в темплейті
export interface LayoutSlot {
  position: number;
  aspectRatio: AspectRatio;
  size: SlotSize;
}

// Слоти для кожного темплейту
export const LAYOUT_SLOTS: Record<PageLayout, LayoutSlot[]> = {
  'single': [
    { position: 1, aspectRatio: '3:2', size: 'large' },
  ],
  'two-horizontal': [
    { position: 1, aspectRatio: '16:9', size: 'medium' },
    { position: 2, aspectRatio: '16:9', size: 'medium' },
  ],
  'two-vertical': [
    { position: 1, aspectRatio: '9:16', size: 'medium' },
    { position: 2, aspectRatio: '9:16', size: 'medium' },
  ],
  'three-rows': [
    { position: 1, aspectRatio: '16:9', size: 'medium' },
    { position: 2, aspectRatio: '16:9', size: 'medium' },
    { position: 3, aspectRatio: '16:9', size: 'medium' },
  ],
  'grid-2x2': [
    { position: 1, aspectRatio: '1:1', size: 'small' },
    { position: 2, aspectRatio: '1:1', size: 'small' },
    { position: 3, aspectRatio: '1:1', size: 'small' },
    { position: 4, aspectRatio: '1:1', size: 'small' },
  ],
  'big-left': [
    { position: 1, aspectRatio: '2:3', size: 'large' },
    { position: 2, aspectRatio: '4:3', size: 'small' },
    { position: 3, aspectRatio: '4:3', size: 'small' },
  ],
  'big-right': [
    { position: 1, aspectRatio: '4:3', size: 'small' },
    { position: 2, aspectRatio: '4:3', size: 'small' },
    { position: 3, aspectRatio: '2:3', size: 'large' },
  ],
  'big-top': [
    { position: 1, aspectRatio: '16:9', size: 'large' },
    { position: 2, aspectRatio: '1:1', size: 'small' },
    { position: 3, aspectRatio: '1:1', size: 'small' },
  ],
  'big-bottom': [
    { position: 1, aspectRatio: '1:1', size: 'small' },
    { position: 2, aspectRatio: '1:1', size: 'small' },
    { position: 3, aspectRatio: '16:9', size: 'large' },
  ],
  'strip-3': [
    { position: 1, aspectRatio: '2:3', size: 'medium' },
    { position: 2, aspectRatio: '2:3', size: 'medium' },
    { position: 3, aspectRatio: '2:3', size: 'medium' },
  ],
  'manga-3': [
    { position: 1, aspectRatio: '3:4', size: 'large' },
    { position: 2, aspectRatio: '4:3', size: 'small' },
    { position: 3, aspectRatio: '4:3', size: 'small' },
  ],
  'action': [
    { position: 1, aspectRatio: '16:9', size: 'large' },
    { position: 2, aspectRatio: '1:1', size: 'small' },
    { position: 3, aspectRatio: '1:1', size: 'small' },
    { position: 4, aspectRatio: '1:1', size: 'small' },
    { position: 5, aspectRatio: '16:9', size: 'medium' },
  ],
};

// Запит на планування коміксу
export interface ComicPlanRequest {
  prompt: string;
  style: ComicVisualStyle;    // 'noir', 'manga', etc.
  maxPages?: number;          // 1-20, default: 5
  language?: 'uk' | 'en';     // default: 'uk'
}

// Тип тіла персонажа
export type BodyType = 'slim' | 'average' | 'athletic' | 'muscular' | 'heavy' | 'petite';

// Вираз обличчя
export type FacialExpression =
  | 'neutral' | 'happy' | 'sad' | 'angry' | 'fearful'
  | 'surprised' | 'disgusted' | 'contempt' | 'determined'
  | 'worried' | 'pensive' | 'smirking' | 'crying' | 'laughing'
  | 'focused' | 'confused' | 'shocked' | 'relieved' | 'hopeful'
  | 'anxious';

// Персонаж коміксу
export interface ComicCharacter {
  id: string;               // "char-1"
  name: string;             // "Marcus"

  // Зовнішність
  age: number;              // 34
  gender: 'male' | 'female' | 'other';
  bodyType: BodyType;
  height: string;           // "182 cm" або "tall"

  // Обличчя (для консистентності)
  face: {
    shape: string;          // "oval", "square", "round"
    eyes: string;           // "deep-set brown eyes"
    nose: string;           // "straight nose"
    mouth: string;          // "thin lips"
    hair: string;           // "short black hair, slicked back"
    distinctiveFeatures: string; // "scar on left cheek, stubble"
  };

  skinTone: string;         // "olive", "pale", "dark brown"
  defaultExpression: string;  // Free-form expression (e.g. "anxious", "determined")

  clothing: string;         // Одяг за замовчуванням
  role: string;             // Роль в історії
  seed?: number;            // Seed для консистентності
}

// ========================================
// SIMPLE TEXT SYSTEM
// ========================================

// 9 можливих позицій для розміщення тексту в панелі (legacy)
export type TextPlacement =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

// Напрямок хвостика бабла
export type TailDirection =
  | 'top-left' | 'top-center' | 'top-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'
  | 'left-top' | 'left-center' | 'left-bottom'
  | 'right-top' | 'right-center' | 'right-bottom'
  | 'none';

// Точне розміщення в % (0-100)
export interface PrecisePlacement {
  x: number;              // 0-100% від лівого краю
  y: number;              // 0-100% від верхнього краю
  width: number;          // Ширина в % панелі
  height: number;         // Висота в % панелі
  tailDirection: TailDirection;
}

// Діалог - простий, від LLM
export interface PanelDialogue {
  characterId: string;      // ID персонажа (char-1, anon-editor)
  text: string;             // Текст діалогу
  placement?: TextPlacement; // Де розмістити (legacy, default: auto)
  precisePlacement?: PrecisePlacement; // Точні координати від Vision AI
}

// Структурована камера (flexible strings for LLM creativity)
export interface CameraSetup {
  shot: string;             // "close-up", "extreme close-up on hands", "wide establishing shot"
  angle: string;            // "low-angle", "slightly tilted", "bird's eye view"
  focus?: string;           // На чому фокус (ID персонажа або "background", "action")
}

// Персонаж в панелі
export interface CharacterInPanel {
  characterId: string;
  expression: string;       // "determined", "cautious", etc. (flexible for LLM output)
  pose: string;             // "standing", "running", etc. (flexible for LLM output)
  gesture?: string;         // "pointing", "holding gun", "arms crossed"
  gazeDirection?: string;   // "at char-2", "at viewer", "off-screen left"
}

// План панелі (без картинки)
export interface PanelPlan {
  id: string;               // "ch1-p1-pan1"
  position: number;         // 1, 2, 3... (порядок в темплейті)

  // Персонажі з деталями
  characters: CharacterInPanel[];

  // Дія та локація
  action: string;           // Що відбувається в цій панелі
  mood: string;             // "intense", "romantic", "scary"

  // Камера
  camera: CameraSetup;

  // Текст - простий формат
  dialogue: PanelDialogue[];        // Діалоги з placement hint
  narrative: string | null;         // Текст наратора
  narrativePlacement?: TextPlacement; // Де розмістити наратив (legacy, default: top-left)
  narrativePrecisePlacement?: PrecisePlacement; // Точні координати для наративу
  sfx: string | null;               // "BOOM!", "CRASH!"
  sfxPrecisePlacement?: PrecisePlacement; // Точні координати для SFX

  // Image generation (for Flux)
  aspectRatio: AspectRatio; // From layout slot, e.g. "16:9", "1:1", "2:3"
  imagePrompt: string;      // Ready-to-use prompt for Flux image generation
  negativePrompt?: string;  // What to avoid in the image
  characterSeeds?: Record<string, number>; // { "char-1": 350944, "char-2": 496086 } for face consistency

  // Generated image
  imageUrl?: string;        // URL of generated image (filled by generate-v2)
}

// Сцена сторінки (спільна локація)
export interface PageScene {
  location: string;         // "Normandy beach, dawn"
  weather?: string;         // "rainy", "sunny", "foggy"
  timeOfDay?: string;       // "dawn", "noon", "dusk", "night"
}

// Сторінка коміксу
export interface ComicPage {
  id: string;
  pageNumber: number;
  layout: PageLayout;
  scene: PageScene;         // Спільна сцена для всіх панелей
  summary: string;          // Короткий опис подій на сторінці (для контексту)
  charactersInScene: string[]; // ["char-1", "anon-editor"] — персонажі в цій сцені
  panels: PanelPlan[];
}

// Розділ коміксу
export interface ComicChapter {
  id: string;
  title: string;
  pages: ComicPage[];
}

// Повний план коміксу
export interface ComicPlan {
  id: string;
  title: string;
  style: ComicVisualStyle;    // 'noir', 'manga', etc.
  characters: ComicCharacter[];
  chapters: ComicChapter[];
  createdAt: string;
}
