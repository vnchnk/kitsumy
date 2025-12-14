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

// Clip path presets - points are in percentages (0-100)
export const CLIP_PRESETS = {
  'none': { name: 'Rectangle', points: [[0,0], [100,0], [100,100], [0,100]] },
  'slight-1': { name: 'Slight 1', points: [[0,1], [99,0], [100,99], [1,100]] },
  'slight-2': { name: 'Slight 2', points: [[1,0], [100,1], [99,100], [0,99]] },
  'slight-3': { name: 'Slight 3', points: [[2,2], [98,0], [100,98], [0,100]] },
  'trapezoid-left': { name: 'Trapezoid ←', points: [[8,0], [100,0], [100,100], [0,100]] },
  'trapezoid-right': { name: 'Trapezoid →', points: [[0,0], [92,0], [100,100], [0,100]] },
  'trapezoid-top': { name: 'Trapezoid ↑', points: [[8,0], [92,0], [100,100], [0,100]] },
  'trapezoid-bottom': { name: 'Trapezoid ↓', points: [[0,0], [100,0], [92,100], [8,100]] },
  'parallelogram-right': { name: 'Parallel →', points: [[10,0], [100,0], [90,100], [0,100]] },
  'parallelogram-left': { name: 'Parallel ←', points: [[0,0], [90,0], [100,100], [10,100]] },
  'slant-right': { name: 'Slant →', points: [[0,0], [100,8], [100,100], [0,92]] },
  'slant-left': { name: 'Slant ←', points: [[0,8], [100,0], [100,92], [0,100]] },
  'chevron-right': { name: 'Chevron →', points: [[0,0], [85,0], [100,50], [85,100], [0,100]] },
  'chevron-left': { name: 'Chevron ←', points: [[15,0], [100,0], [100,100], [15,100], [0,50]] },
  'pentagon': { name: 'Pentagon', points: [[50,0], [100,38], [82,100], [18,100], [0,38]] },
  'hexagon': { name: 'Hexagon', points: [[25,0], [75,0], [100,50], [75,100], [25,100], [0,50]] },
  'octagon': { name: 'Octagon', points: [[30,0], [70,0], [100,30], [100,70], [70,100], [30,100], [0,70], [0,30]] },
  'burst-4': { name: 'Burst 4', points: [[50,0], [60,40], [100,50], [60,60], [50,100], [40,60], [0,50], [40,40]] },
  'torn-top': { name: 'Torn Top', points: [[0,5], [20,0], [40,8], [60,2], [80,6], [100,0], [100,100], [0,100]] },
  'torn-bottom': { name: 'Torn Bottom', points: [[0,0], [100,0], [100,95], [80,100], [60,92], [40,98], [20,94], [0,100]] },
  'wave-left': { name: 'Wave ←', points: [[8,0], [100,0], [100,100], [8,100], [0,85], [5,70], [0,55], [5,40], [0,25], [5,10]] },
  'wave-right': { name: 'Wave →', points: [[0,0], [92,0], [100,10], [95,25], [100,40], [95,55], [100,70], [95,85], [92,100], [0,100]] },
  'corner-cut': { name: 'Corner Cut', points: [[15,0], [100,0], [100,85], [85,100], [0,100], [0,15]] },
  'ticket': { name: 'Ticket', points: [[10,0], [90,0], [100,10], [100,90], [90,100], [10,100], [0,90], [0,10]] },
} as const;

export type ClipPreset = keyof typeof CLIP_PRESETS;

// Border styles for comic panels
export const BORDER_STYLES = {
  'clean': { name: 'Clean', description: 'Sharp clean edges' },
  'rough': { name: 'Rough', description: 'Slightly uneven edges' },
  'sketchy': { name: 'Sketchy', description: 'Hand-drawn look' },
  'double': { name: 'Double', description: 'Double line border' },
  'worn': { name: 'Worn', description: 'Aged, faded edges' },
  'ink': { name: 'Ink Bleed', description: 'Ink bleeding effect' },
  'none': { name: 'None', description: 'No border' },
} as const;

export type BorderStyle = keyof typeof BORDER_STYLES;

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
  borderStyle: BorderStyle;
  sepiaLevel: number;
  // Clip path
  clipPreset: ClipPreset;
  customClipPath: number[][] | null; // [[x,y], [x,y], ...] in percentages
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
  borderStyle: BorderStyle;
  createdAt: string;
  updatedAt: string;
}

export type Tool = 'select' | 'pan' | 'add-image' | 'add-narrative' | 'add-dialogue';
