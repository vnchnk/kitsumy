export enum AppMode {
  LEARNING = 'learning',
  CREATIVE = 'creative',
  THERAPY = 'therapy',
}

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
  artStyle?: ArtStyle;
  maxPages?: number;  // Limit number of pages (1-20), default: unlimited
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

