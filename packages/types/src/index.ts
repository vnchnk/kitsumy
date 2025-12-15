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

