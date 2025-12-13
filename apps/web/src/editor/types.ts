export type ElementType = 'image' | 'narrative' | 'dialogue';

// Paper sizes in pixels (at 96 DPI)
export const PAPER_SIZES = {
  'A4': { width: 794, height: 1123, label: 'A4 (210×297mm)' },
  'A4-landscape': { width: 1123, height: 794, label: 'A4 Landscape' },
  'A3': { width: 1123, height: 1587, label: 'A3 (297×420mm)' },
  'A3-landscape': { width: 1587, height: 1123, label: 'A3 Landscape' },
  'Letter': { width: 816, height: 1056, label: 'Letter (8.5×11")' },
  'Letter-landscape': { width: 1056, height: 816, label: 'Letter Landscape' },
  'Poster': { width: 1800, height: 2400, label: 'Poster (18×24")' },
  'Poster-landscape': { width: 2400, height: 1800, label: 'Poster Landscape' },
  'Square': { width: 1000, height: 1000, label: 'Square (1000×1000)' },
  'Instagram': { width: 1080, height: 1080, label: 'Instagram (1080×1080)' },
  'Custom': { width: 800, height: 1000, label: 'Custom' },
} as const;

export type PaperSize = keyof typeof PAPER_SIZES;
export type CanvasLayout = 'horizontal' | 'vertical' | 'grid';

export interface BaseElement {
  id: string;
  type: ElementType;
  // Position (absolute on canvas)
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  imageUrl: string;
  // Style
  borderWidth: number;
  borderColor: string;
  sepiaLevel: number;
  clipVariant: number;
  showOverlay: boolean;
}

export interface NarrativeElement extends BaseElement {
  type: 'narrative';
  text: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  borderWidth: number;
  fontSize: number;
  fontFamily: 'comic' | 'serif' | 'sans';
  padding: number;
}

export interface DialogueElement extends BaseElement {
  type: 'dialogue';
  speaker: string;
  text: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  borderWidth: number;
  fontSize: number;
  tailPosition: 'left' | 'right' | 'bottom-left' | 'bottom-right' | 'none';
  bubbleStyle: 'round' | 'cloud' | 'square' | 'shout';
}

export type CanvasElement = ImageElement | NarrativeElement | DialogueElement;

export interface Canvas {
  id: string;
  name: string;
  elements: CanvasElement[];
  width: number;
  height: number;
  backgroundColor: string;
  order: number;
}

export interface EditorProject {
  id: string;
  title: string;
  canvases: Canvas[];
  paperSize: PaperSize;
  layout: CanvasLayout;
  createdAt: string;
  updatedAt: string;
}

export type Tool = 'select' | 'pan' | 'add-image' | 'add-narrative' | 'add-dialogue';
