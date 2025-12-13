export type ElementType = 'image' | 'narrative' | 'dialogue';

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

export interface EditorProject {
  id: string;
  title: string;
  elements: CanvasElement[];
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  createdAt: string;
  updatedAt: string;
}

export type Tool = 'select' | 'pan' | 'add-image' | 'add-narrative' | 'add-dialogue';
