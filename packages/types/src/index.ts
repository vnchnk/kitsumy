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

export interface ComicPanel {
  id: string;
  imageUrl: string;
  narrative: string;
  dialogue: Array<{ speaker: string; text: string }>;
  soundVibe: string;
}

export interface GenerationRequest {
  mode: AppMode;
  prompt: string;
  style?: ComicStyle;  // Comic art style
  maxPages?: number;   // Limit number of pages (1-20), default: unlimited
  userContext: {
    gradeLevel?: number;
    mood?: string;
    previousTopic?: string;
  };
}

export interface GenerationResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// ============================================
// Comic Planner Types
// ============================================

// Візуальний стиль (як малювати) - переіменовуємо ComicStyle
export type ComicVisualStyle = ComicStyle;

// Сеттінг світу (який світ)
export type ComicSetting =
  | 'realistic'          // За замовчуванням — без фантастики
  | 'sci-fi'             // Космос, технології майбутнього
  | 'cyberpunk'          // Кіберімпланти, неон, dystopia
  | 'fantasy'            // Магія, дракони, ельфи
  | 'steampunk'          // Вікторіанська епоха + технології
  | 'supernatural'       // Привиди, вампіри, демони
  | 'post-apocalyptic';  // Після катастрофи

export const COMIC_SETTING_NAMES: Record<ComicSetting, string> = {
  'realistic': 'Realistic',
  'sci-fi': 'Sci-Fi',
  'cyberpunk': 'Cyberpunk',
  'fantasy': 'Fantasy',
  'steampunk': 'Steampunk',
  'supernatural': 'Supernatural',
  'post-apocalyptic': 'Post-Apocalyptic',
};

// Об'єднаний стиль
export interface ComicStyleConfig {
  visual: ComicVisualStyle;       // Як малювати (noir, manga, etc.)
  setting?: ComicSetting;         // Який світ (default: 'realistic')
}

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
  style: ComicStyleConfig;    // { visual: 'noir', setting: 'realistic' }
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
  | 'focused' | 'confused' | 'shocked' | 'relieved' | 'hopeful';

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
  defaultExpression: FacialExpression;

  clothing: string;         // Одяг за замовчуванням
  role: string;             // Роль в історії
  seed?: number;            // Seed для консистентності
}

// Позиція bubble для діалогу
export type BubblePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';

// Діалог
export interface PanelDialogue {
  characterId: string;      // ID персонажа
  text: string;
  bubblePosition?: BubblePosition; // Позиція bubble на панелі
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

  // Текст
  dialogue: PanelDialogue[];
  narrative: string | null; // Текст наратора
  sfx: string | null;       // "BOOM!", "CRASH!"

  // Image generation (for Flux)
  aspectRatio: AspectRatio; // From layout slot, e.g. "16:9", "1:1", "2:3"
  imagePrompt: string;      // Ready-to-use prompt for Flux image generation
  negativePrompt?: string;  // What to avoid in the image
  characterSeeds?: Record<string, number>; // { "char-1": 350944, "char-2": 496086 } for face consistency
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
  style: ComicStyleConfig;    // { visual, setting }
  characters: ComicCharacter[];
  chapters: ComicChapter[];
  createdAt: string;
}

// Відповідь планування
export interface ComicPlanResponse {
  success: boolean;
  plan?: ComicPlan;
  error?: string;
}

