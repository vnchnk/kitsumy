import { create } from 'zustand';
import {
  EditorProject,
  Tool,
  CanvasElement,
  ElementType,
  ImageElement,
  NarrativeElement,
  DialogueElement,
  Canvas,
  PaperSize,
  CanvasLayout,
  BorderStyle,
  TailPosition,
  BubbleStyle,
  PAPER_SIZES,
} from './types';

interface HistoryEntry {
  canvases: Canvas[];
  timestamp: number;
}

interface EditorState {
  project: EditorProject | null;
  activeCanvasId: string | null;
  selectedIds: string[];
  tool: Tool;
  zoom: number;
  panOffset: { x: number; y: number };
  
  // Undo/Redo
  history: HistoryEntry[];
  historyIndex: number;

  // Project actions
  initProject: (id: string) => void;
  setProjectTitle: (title: string) => void;
  setPaperSize: (size: PaperSize) => void;
  setLayout: (layout: CanvasLayout) => void;
  setBorderStyle: (style: BorderStyle) => void;

  // Canvas actions
  addCanvas: () => void;
  removeCanvas: (id: string) => void;
  setActiveCanvas: (id: string) => void;
  updateCanvas: (id: string, updates: Partial<Canvas>) => void;
  reorderCanvas: (id: string, newOrder: number) => void;
  duplicateCanvas: (id: string) => void;

  // Element actions (operate on active canvas)
  addElements: (elements: CanvasElement[]) => void;
  addElement: (type: ElementType, x: number, y: number) => void;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  deleteElement: (id: string) => void;
  deleteSelected: () => void;
  select: (id: string, addToSelection?: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  duplicateSelected: () => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  moveUp: (id: string) => void;
  moveDown: (id: string) => void;

  // Tool/View
  setTool: (tool: Tool) => void;
  setZoom: (zoom: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  focusOnCanvas: (canvasId: string, viewportWidth: number, viewportHeight: number) => void;
  
  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  commitToHistory: () => void;
  
  // Export
  exportJSON: () => string;
  importJSON: (json: string) => void;

  // Helpers
  getActiveCanvas: () => Canvas | null;
}

const createId = () => Math.random().toString(36).slice(2, 11);

const getMaxZIndex = (elements: CanvasElement[]) =>
  elements.reduce((max, el) => Math.max(max, el.zIndex), 0);

const createDefaultImage = (x: number, y: number, zIndex: number): ImageElement => ({
  id: createId(),
  type: 'image',
  x,
  y,
  width: 400,
  height: 500,
  rotation: 0,
  zIndex,
  imageUrl: '',
  borderWidth: 4,
  borderColor: '#000000',
  borderStyle: 'clean',
  sepiaLevel: 0.15,
  clipPreset: 'none',
  customClipPath: null,
  showOverlay: true,
});

const createDefaultNarrative = (x: number, y: number, zIndex: number): NarrativeElement => ({
  id: createId(),
  type: 'narrative',
  x,
  y,
  width: 280,
  height: 80,
  rotation: -1,
  zIndex,
  text: 'Narrative text...',
  bgColor: '#fff133',
  textColor: '#000000',
  borderColor: '#000000',
  borderWidth: 3,
  fontSize: 14,
  fontFamily: 'comic',
  padding: 12,
});

const createDefaultDialogue = (x: number, y: number, zIndex: number): DialogueElement => ({
  id: createId(),
  type: 'dialogue',
  x,
  y,
  width: 200,
  height: 100,
  rotation: 0,
  zIndex,
  speaker: 'CHARACTER',
  text: 'Dialogue text...',
  bgColor: '#ffffff',
  textColor: '#000000',
  borderColor: '#000000',
  borderWidth: 3,
  fontSize: 14,
  tailPosition: 'bottom-left',
  bubbleStyle: 'round',
});

const createDefaultCanvas = (order: number, paperSize: PaperSize): Canvas => {
  const size = PAPER_SIZES[paperSize];
  return {
    id: createId(),
    name: '',
    elements: [],
    width: size.width,
    height: size.height,
    backgroundColor: '#ffffff',
    order,
  };
};

const saveProject = (project: EditorProject) => {
  localStorage.setItem(`kitsumy-project-${project.id}`, JSON.stringify(project));
};

const MAX_HISTORY = 50;

const pushHistory = (state: EditorState, canvases: Canvas[]): Partial<EditorState> => {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push({ canvases: JSON.parse(JSON.stringify(canvases)), timestamp: Date.now() });
  if (newHistory.length > MAX_HISTORY) {
    newHistory.shift();
  }
  return {
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
};

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  activeCanvasId: null,
  selectedIds: [],
  tool: 'select',
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  history: [],
  historyIndex: -1,

  initProject: (id) => {
    const saved = localStorage.getItem(`kitsumy-project-${id}`);
    if (saved) {
      const project = JSON.parse(saved) as EditorProject;
      
      // Valid project with canvases
      if (project.canvases && project.canvases.length > 0) {
        const initialHistory = [{ canvases: JSON.parse(JSON.stringify(project.canvases)), timestamp: Date.now() }];
        set({ 
          project, 
          activeCanvasId: project.canvases[0].id,
          history: initialHistory, 
          historyIndex: 0 
        });
        return;
      }
    }
    
    // Create new project
    const defaultCanvas = createDefaultCanvas(0, 'A4');
    const project: EditorProject = {
      id,
      title: 'Untitled Comic',
      canvases: [defaultCanvas],
      paperSize: 'A4',
      layout: 'horizontal',
      borderStyle: 'clean',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveProject(project);
    set({
      project,
      activeCanvasId: defaultCanvas.id,
      history: [{ canvases: [defaultCanvas], timestamp: Date.now() }],
      historyIndex: 0,
    });
  },

  setProjectTitle: (title) => {
    set((state) => {
      if (!state.project) return state;
      const updated = { ...state.project, title, updatedAt: new Date().toISOString() };
      saveProject(updated);
      return { project: updated };
    });
  },

  setPaperSize: (paperSize) => {
    set((state) => {
      if (!state.project) return state;
      const size = PAPER_SIZES[paperSize];
      const updatedCanvases = state.project.canvases.map(c => ({
        ...c,
        width: size.width,
        height: size.height,
      }));
      const updated = { 
        ...state.project, 
        paperSize, 
        canvases: updatedCanvases,
        updatedAt: new Date().toISOString() 
      };
      saveProject(updated);
      return { project: updated, ...pushHistory(state, updatedCanvases) };
    });
  },

  setLayout: (layout) => {
    set((state) => {
      if (!state.project) return state;
      const updated = { ...state.project, layout, updatedAt: new Date().toISOString() };
      saveProject(updated);
      return { project: updated };
    });
  },

  setBorderStyle: (borderStyle) => {
    set((state) => {
      if (!state.project) return state;
      const updated = { ...state.project, borderStyle, updatedAt: new Date().toISOString() };
      saveProject(updated);
      return { project: updated };
    });
  },

  addCanvas: () => {
    set((state) => {
      if (!state.project) return state;
      const newCanvas = createDefaultCanvas(state.project.canvases.length, state.project.paperSize);
      const updatedCanvases = [...state.project.canvases, newCanvas];
      const updated = {
        ...state.project,
        canvases: updatedCanvases,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { 
        project: updated, 
        activeCanvasId: newCanvas.id,
        selectedIds: [],
        ...pushHistory(state, updatedCanvases) 
      };
    });
  },

  removeCanvas: (id) => {
    set((state) => {
      if (!state.project || state.project.canvases.length <= 1) return state;
      const updatedCanvases = state.project.canvases
        .filter(c => c.id !== id)
        .map((c, i) => ({ ...c, order: i }));
      const updated = {
        ...state.project,
        canvases: updatedCanvases,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      const newActiveId = state.activeCanvasId === id 
        ? updatedCanvases[0]?.id || null 
        : state.activeCanvasId;
      return { 
        project: updated, 
        activeCanvasId: newActiveId,
        selectedIds: [],
        ...pushHistory(state, updatedCanvases) 
      };
    });
  },

  setActiveCanvas: (id) => {
    set({ activeCanvasId: id, selectedIds: [] });
  },

  updateCanvas: (id, updates) => {
    set((state) => {
      if (!state.project) return state;
      const updatedCanvases = state.project.canvases.map(c =>
        c.id === id ? { ...c, ...updates } : c
      );
      const updated = {
        ...state.project,
        canvases: updatedCanvases,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { project: updated };
    });
  },

  reorderCanvas: (id, newOrder) => {
    set((state) => {
      if (!state.project) return state;
      const canvas = state.project.canvases.find(c => c.id === id);
      if (!canvas) return state;
      
      const otherCanvases = state.project.canvases.filter(c => c.id !== id);
      otherCanvases.splice(newOrder, 0, canvas);
      const updatedCanvases = otherCanvases.map((c, i) => ({ ...c, order: i }));
      
      const updated = {
        ...state.project,
        canvases: updatedCanvases,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { project: updated };
    });
  },

  duplicateCanvas: (id) => {
    set((state) => {
      if (!state.project) return state;
      const canvas = state.project.canvases.find(c => c.id === id);
      if (!canvas) return state;
      
      const newCanvas: Canvas = {
        ...canvas,
        id: createId(),
        name: '',
        order: state.project.canvases.length,
        elements: canvas.elements.map(el => ({ ...el, id: createId() })),
      };
      
      const updatedCanvases = [...state.project.canvases, newCanvas];
      const updated = {
        ...state.project,
        canvases: updatedCanvases,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { 
        project: updated, 
        activeCanvasId: newCanvas.id,
        selectedIds: [],
        ...pushHistory(state, updatedCanvases) 
      };
    });
  },

  getActiveCanvas: () => {
    const { project, activeCanvasId } = get();
    if (!project || !activeCanvasId) return null;
    return project.canvases.find(c => c.id === activeCanvasId) || null;
  },

  // Element actions - operate on active canvas
  addElements: (elements) => {
    set((state) => {
      const canvas = get().getActiveCanvas();
      if (!state.project || !canvas) return state;
      
      const updatedCanvases = state.project.canvases.map(c =>
        c.id === canvas.id ? { ...c, elements: [...c.elements, ...elements] } : c
      );
      const updated = {
        ...state.project,
        canvases: updatedCanvases,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { project: updated, ...pushHistory(state, updatedCanvases) };
    });
  },

  addElement: (type, x, y) => {
    set((state) => {
      const canvas = get().getActiveCanvas();
      if (!state.project || !canvas) return state;
      
      const zIndex = getMaxZIndex(canvas.elements) + 1;
      let newElement: CanvasElement;

      switch (type) {
        case 'image':
          newElement = createDefaultImage(x, y, zIndex);
          break;
        case 'narrative':
          newElement = createDefaultNarrative(x, y, zIndex);
          break;
        case 'dialogue':
          newElement = createDefaultDialogue(x, y, zIndex);
          break;
      }

      const updatedCanvases = state.project.canvases.map(c =>
        c.id === canvas.id ? { ...c, elements: [...c.elements, newElement] } : c
      );
      const updated = {
        ...state.project,
        canvases: updatedCanvases,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { project: updated, selectedIds: [newElement.id], tool: 'select', ...pushHistory(state, updatedCanvases) };
    });
  },

  updateElement: (id, updates) => {
    set((state) => {
      const canvas = get().getActiveCanvas();
      if (!state.project || !canvas) return state;
      
      const updatedCanvases = state.project.canvases.map(c =>
        c.id === canvas.id 
          ? { ...c, elements: c.elements.map(el => el.id === id ? { ...el, ...updates } : el) as CanvasElement[] }
          : c
      );
      const updated = {
        ...state.project,
        canvases: updatedCanvases,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { project: updated };
    });
  },

  deleteElement: (id) => {
    set((state) => {
      const canvas = get().getActiveCanvas();
      if (!state.project || !canvas) return state;
      
      const updatedCanvases = state.project.canvases.map(c =>
        c.id === canvas.id ? { ...c, elements: c.elements.filter(el => el.id !== id) } : c
      );
      const updated = {
        ...state.project,
        canvases: updatedCanvases,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return {
        project: updated,
        selectedIds: state.selectedIds.filter(sid => sid !== id),
        ...pushHistory(state, updatedCanvases),
      };
    });
  },

  deleteSelected: () => {
    set((state) => {
      const canvas = get().getActiveCanvas();
      if (!state.project || !canvas || state.selectedIds.length === 0) return state;
      
      const updatedCanvases = state.project.canvases.map(c =>
        c.id === canvas.id ? { ...c, elements: c.elements.filter(el => !state.selectedIds.includes(el.id)) } : c
      );
      const updated = {
        ...state.project,
        canvases: updatedCanvases,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { project: updated, selectedIds: [], ...pushHistory(state, updatedCanvases) };
    });
  },

  select: (id, addToSelection = false) => {
    set((state) => {
      if (addToSelection) {
        const isSelected = state.selectedIds.includes(id);
        return {
          selectedIds: isSelected
            ? state.selectedIds.filter(sid => sid !== id)
            : [...state.selectedIds, id],
        };
      }
      return { selectedIds: [id] };
    });
  },

  selectAll: () => {
    const canvas = get().getActiveCanvas();
    if (!canvas) return;
    set({ selectedIds: canvas.elements.map(el => el.id) });
  },

  clearSelection: () => set({ selectedIds: [] }),

  duplicateSelected: () => {
    set((state) => {
      const canvas = get().getActiveCanvas();
      if (!state.project || !canvas || state.selectedIds.length === 0) return state;
      
      const maxZ = getMaxZIndex(canvas.elements);
      const newElements: CanvasElement[] = [];
      const newIds: string[] = [];

      state.selectedIds.forEach((id, i) => {
        const el = canvas.elements.find(e => e.id === id);
        if (el) {
          const newEl = {
            ...el,
            id: createId(),
            x: el.x + 30,
            y: el.y + 30,
            zIndex: maxZ + 1 + i,
          } as CanvasElement;
          newElements.push(newEl);
          newIds.push(newEl.id);
        }
      });

      const updatedCanvases = state.project.canvases.map(c =>
        c.id === canvas.id ? { ...c, elements: [...c.elements, ...newElements] } : c
      );
      const updated = {
        ...state.project,
        canvases: updatedCanvases,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { project: updated, selectedIds: newIds, ...pushHistory(state, updatedCanvases) };
    });
  },

  bringToFront: (id) => {
    set((state) => {
      const canvas = get().getActiveCanvas();
      if (!state.project || !canvas) return state;
      
      const maxZ = getMaxZIndex(canvas.elements);
      const updatedCanvases = state.project.canvases.map(c =>
        c.id === canvas.id
          ? { ...c, elements: c.elements.map(el => el.id === id ? { ...el, zIndex: maxZ + 1 } : el) as CanvasElement[] }
          : c
      );
      const updated = {
        ...state.project,
        canvases: updatedCanvases,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { project: updated };
    });
  },

  sendToBack: (id) => {
    set((state) => {
      const canvas = get().getActiveCanvas();
      if (!state.project || !canvas) return state;
      
      const minZ = Math.min(...canvas.elements.map(el => el.zIndex));
      const updatedCanvases = state.project.canvases.map(c =>
        c.id === canvas.id
          ? { ...c, elements: c.elements.map(el => el.id === id ? { ...el, zIndex: minZ - 1 } : el) as CanvasElement[] }
          : c
      );
      const updated = {
        ...state.project,
        canvases: updatedCanvases,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { project: updated };
    });
  },

  moveUp: (id) => {
    set((state) => {
      const canvas = get().getActiveCanvas();
      if (!state.project || !canvas) return state;
      
      const updatedCanvases = state.project.canvases.map(c =>
        c.id === canvas.id
          ? { ...c, elements: c.elements.map(el => el.id === id ? { ...el, zIndex: el.zIndex + 1 } : el) as CanvasElement[] }
          : c
      );
      const updated = {
        ...state.project,
        canvases: updatedCanvases,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { project: updated };
    });
  },

  moveDown: (id) => {
    set((state) => {
      const canvas = get().getActiveCanvas();
      if (!state.project || !canvas) return state;
      
      const updatedCanvases = state.project.canvases.map(c =>
        c.id === canvas.id
          ? { ...c, elements: c.elements.map(el => el.id === id ? { ...el, zIndex: Math.max(0, el.zIndex - 1) } : el) as CanvasElement[] }
          : c
      );
      const updated = {
        ...state.project,
        canvases: updatedCanvases,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { project: updated };
    });
  },

  setTool: (tool) => set({ tool }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(3, zoom)) }),
  setPanOffset: (panOffset) => set({ panOffset }),
  
  focusOnCanvas: (canvasId, viewportWidth, viewportHeight) => {
    const state = get();
    if (!state.project) return;
    
    const GAP = 40;
    const sortedCanvases = [...state.project.canvases].sort((a, b) => a.order - b.order);
    const cols = state.project.layout === 'grid' ? Math.ceil(Math.sqrt(sortedCanvases.length)) : 1;
    
    // Find canvas and calculate its position
    let targetX = 0, targetY = 0;
    let targetCanvas: Canvas | null = null;
    let x = 0, y = 0;
    
    for (let i = 0; i < sortedCanvases.length; i++) {
      const canvas = sortedCanvases[i];
      if (state.project.layout === 'horizontal') {
        if (canvas.id === canvasId) {
          targetX = x;
          targetY = 0;
          targetCanvas = canvas;
          break;
        }
        x += canvas.width + GAP;
      } else if (state.project.layout === 'vertical') {
        if (canvas.id === canvasId) {
          targetX = 0;
          targetY = y;
          targetCanvas = canvas;
          break;
        }
        y += canvas.height + GAP;
      } else {
        // Grid
        const col = i % cols;
        const row = Math.floor(i / cols);
        if (canvas.id === canvasId) {
          targetX = col * (canvas.width + GAP);
          targetY = row * (canvas.height + GAP);
          targetCanvas = canvas;
          break;
        }
      }
    }
    
    if (!targetCanvas) return;
    
    // Calculate zoom to fit canvas with padding
    const padding = 60;
    const scaleX = (viewportWidth - padding * 2) / targetCanvas.width;
    const scaleY = (viewportHeight - padding * 2) / targetCanvas.height;
    const newZoom = Math.min(scaleX, scaleY, 1);
    
    // Center the canvas in viewport
    const scaledWidth = targetCanvas.width * newZoom;
    const scaledHeight = targetCanvas.height * newZoom;
    const panX = (viewportWidth - scaledWidth) / 2 - targetX * newZoom;
    const panY = (viewportHeight - scaledHeight) / 2 - targetY * newZoom;
    
    set({ 
      zoom: Math.max(0.1, Math.min(3, newZoom)), 
      panOffset: { x: panX, y: panY },
      activeCanvasId: canvasId,
    });
  },

  undo: () => {
    set((state) => {
      if (state.historyIndex <= 0 || !state.project) return state;
      const newIndex = state.historyIndex - 1;
      const historyEntry = state.history[newIndex];
      const updated = {
        ...state.project,
        canvases: JSON.parse(JSON.stringify(historyEntry.canvases)),
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { project: updated, historyIndex: newIndex, selectedIds: [] };
    });
  },

  redo: () => {
    set((state) => {
      if (state.historyIndex >= state.history.length - 1 || !state.project) return state;
      const newIndex = state.historyIndex + 1;
      const historyEntry = state.history[newIndex];
      const updated = {
        ...state.project,
        canvases: JSON.parse(JSON.stringify(historyEntry.canvases)),
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { project: updated, historyIndex: newIndex, selectedIds: [] };
    });
  },

  canUndo: () => {
    const { historyIndex } = get();
    return historyIndex > 0;
  },

  canRedo: () => {
    const { historyIndex, history } = get();
    return historyIndex < history.length - 1;
  },

  commitToHistory: () => {
    set((state) => {
      if (!state.project) return state;
      return pushHistory(state, state.project.canvases);
    });
  },

  exportJSON: () => {
    const { project } = get();
    return JSON.stringify(project, null, 2);
  },

  importJSON: (json) => {
    try {
      const parsed = JSON.parse(json);

      // Check if this is a ComicPlan (has chapters) or EditorProject (has canvases)
      if (parsed.chapters && !parsed.canvases) {
        // Convert ComicPlan to EditorProject
        const plan = parsed as {
          id: string;
          title: string;
          style?: { visual: string; setting?: string };
          characters?: Array<{ id: string; name: string }>;
          chapters: Array<{
            pages: Array<{
              id: string;
              pageNumber: number;
              layout: string;
              panels: Array<{
                id: string;
                position: number;
                narrative: string | null;
                dialogue: Array<{
                  characterId: string;
                  text: string;
                  bubblePosition?: string;
                  placement?: string;
                  precisePlacement?: {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                    tailDirection: string;
                  };
                }>;
                narrativePlacement?: string;
                narrativePrecisePlacement?: {
                  x: number;
                  y: number;
                  width: number;
                  height: number;
                  tailDirection: string;
                };
                imageUrl?: string;
              }>;
            }>;
          }>;
          createdAt: string;
        };

        // Build character name map for speaker display
        const characterNames = new Map<string, string>();
        if (plan.characters) {
          for (const char of plan.characters) {
            characterNames.set(char.id, char.name);
          }
        }

        // Style presets for different comic visual styles
        type TextStyles = {
          narrative: { bgColor: string; textColor: string; borderColor: string; fontFamily: 'serif' | 'sans' | 'comic' };
          dialogue: { bgColor: string; textColor: string; borderColor: string; bubbleStyle: 'round' | 'cloud' | 'square' | 'shout' };
        };

        const STYLE_PRESETS: Record<string, TextStyles> = {
          'noir': {
            narrative: { bgColor: '#1a1a1a', textColor: '#e0e0e0', borderColor: '#444444', fontFamily: 'serif' },
            dialogue: { bgColor: '#ffffff', textColor: '#1a1a1a', borderColor: '#000000', bubbleStyle: 'round' },
          },
          'manga': {
            narrative: { bgColor: '#ffffff', textColor: '#1a1a1a', borderColor: '#333333', fontFamily: 'sans' },
            dialogue: { bgColor: '#ffffff', textColor: '#1a1a1a', borderColor: '#1a1a1a', bubbleStyle: 'round' },
          },
          'american-classic': {
            narrative: { bgColor: '#fef9e7', textColor: '#1a1a1a', borderColor: '#d4a853', fontFamily: 'comic' },
            dialogue: { bgColor: '#fffef0', textColor: '#1a1a1a', borderColor: '#333333', bubbleStyle: 'round' },
          },
          'euro-bd': {
            narrative: { bgColor: '#f5f0e6', textColor: '#2c2c2c', borderColor: '#8b7355', fontFamily: 'serif' },
            dialogue: { bgColor: '#fefefe', textColor: '#2c2c2c', borderColor: '#4a4a4a', bubbleStyle: 'round' },
          },
          'cyberpunk': {
            narrative: { bgColor: '#0d0d0d', textColor: '#00ffff', borderColor: '#ff00ff', fontFamily: 'sans' },
            dialogue: { bgColor: '#1a0a2e', textColor: '#00ff00', borderColor: '#ff00ff', bubbleStyle: 'square' },
          },
          'horror': {
            narrative: { bgColor: '#1a0a0a', textColor: '#cc0000', borderColor: '#440000', fontFamily: 'serif' },
            dialogue: { bgColor: '#f0e6e6', textColor: '#330000', borderColor: '#660000', bubbleStyle: 'cloud' },
          },
          'watercolor': {
            narrative: { bgColor: '#f8f4e8', textColor: '#3d3d3d', borderColor: '#a89f8c', fontFamily: 'serif' },
            dialogue: { bgColor: '#fffef8', textColor: '#4a4a4a', borderColor: '#b0a090', bubbleStyle: 'cloud' },
          },
          'retro': {
            narrative: { bgColor: '#fff4d4', textColor: '#4a3728', borderColor: '#c49a6c', fontFamily: 'comic' },
            dialogue: { bgColor: '#fffff0', textColor: '#3d3d3d', borderColor: '#8b7355', bubbleStyle: 'round' },
          },
          'pop-art': {
            narrative: { bgColor: '#ffff00', textColor: '#000000', borderColor: '#ff0000', fontFamily: 'comic' },
            dialogue: { bgColor: '#ffffff', textColor: '#000000', borderColor: '#0000ff', bubbleStyle: 'shout' },
          },
          'sketch': {
            narrative: { bgColor: '#fafafa', textColor: '#333333', borderColor: '#999999', fontFamily: 'sans' },
            dialogue: { bgColor: '#ffffff', textColor: '#444444', borderColor: '#888888', bubbleStyle: 'round' },
          },
          'cel-shaded': {
            narrative: { bgColor: '#2d2d44', textColor: '#ffffff', borderColor: '#5858a8', fontFamily: 'sans' },
            dialogue: { bgColor: '#ffffff', textColor: '#1a1a2e', borderColor: '#4a4a8a', bubbleStyle: 'square' },
          },
          'pulp': {
            narrative: { bgColor: '#4a3728', textColor: '#f5deb3', borderColor: '#8b4513', fontFamily: 'serif' },
            dialogue: { bgColor: '#fff8dc', textColor: '#4a3728', borderColor: '#8b4513', bubbleStyle: 'round' },
          },
          'soviet-poster': {
            narrative: { bgColor: '#cc0000', textColor: '#ffffff', borderColor: '#8b0000', fontFamily: 'sans' },
            dialogue: { bgColor: '#fffef0', textColor: '#1a1a1a', borderColor: '#cc0000', bubbleStyle: 'square' },
          },
          'whimsical': {
            narrative: { bgColor: '#e6f3ff', textColor: '#2e5090', borderColor: '#7eb3e0', fontFamily: 'comic' },
            dialogue: { bgColor: '#fff0f5', textColor: '#4a4a4a', borderColor: '#ffb6c1', bubbleStyle: 'cloud' },
          },
          'graffiti': {
            narrative: { bgColor: '#1a1a1a', textColor: '#ff6600', borderColor: '#00cc00', fontFamily: 'sans' },
            dialogue: { bgColor: '#ffffff', textColor: '#1a1a1a', borderColor: '#ff00ff', bubbleStyle: 'shout' },
          },
          'ukiyo-e': {
            narrative: { bgColor: '#f5e6d3', textColor: '#2c1810', borderColor: '#8b4513', fontFamily: 'serif' },
            dialogue: { bgColor: '#fffef5', textColor: '#2c1810', borderColor: '#a0522d', bubbleStyle: 'round' },
          },
          'art-nouveau': {
            narrative: { bgColor: '#f0e6d8', textColor: '#4a3728', borderColor: '#8b7355', fontFamily: 'serif' },
            dialogue: { bgColor: '#fffef8', textColor: '#3d3d3d', borderColor: '#9a8a6a', bubbleStyle: 'cloud' },
          },
          'minimalist': {
            narrative: { bgColor: '#f5f5f5', textColor: '#1a1a1a', borderColor: '#cccccc', fontFamily: 'sans' },
            dialogue: { bgColor: '#ffffff', textColor: '#1a1a1a', borderColor: '#e0e0e0', bubbleStyle: 'round' },
          },
          'woodcut': {
            narrative: { bgColor: '#2c1810', textColor: '#f5deb3', borderColor: '#4a3728', fontFamily: 'serif' },
            dialogue: { bgColor: '#f5e6d3', textColor: '#2c1810', borderColor: '#4a3728', bubbleStyle: 'square' },
          },
          'chibi': {
            narrative: { bgColor: '#fff0f5', textColor: '#4a4a4a', borderColor: '#ffb6c1', fontFamily: 'comic' },
            dialogue: { bgColor: '#ffffff', textColor: '#333333', borderColor: '#ff69b4', bubbleStyle: 'cloud' },
          },
        };

        // Get style preset based on comic visual style
        const visualStyle = plan.style?.visual || 'american-classic';
        const stylePreset = STYLE_PRESETS[visualStyle] || STYLE_PRESETS['american-classic'];

        // Layout panel positions (from TemplatesPanel.tsx) - percentages
        const EDGE_MARGIN = 1.5;
        const PANEL_GAP = 2;

        const calcPanels = (layout: { cols: number; rows: number; spans?: { col: number; row: number; colSpan: number; rowSpan: number }[] }) => {
          const { cols, rows, spans } = layout;
          const availableW = 100 - 2 * EDGE_MARGIN - (cols - 1) * PANEL_GAP;
          const availableH = 100 - 2 * EDGE_MARGIN - (rows - 1) * PANEL_GAP;
          const cellW = availableW / cols;
          const cellH = availableH / rows;

          if (spans) {
            return spans.map(({ col, row, colSpan, rowSpan }) => ({
              x: EDGE_MARGIN + col * (cellW + PANEL_GAP),
              y: EDGE_MARGIN + row * (cellH + PANEL_GAP),
              w: colSpan * cellW + (colSpan - 1) * PANEL_GAP,
              h: rowSpan * cellH + (rowSpan - 1) * PANEL_GAP,
            }));
          }

          const panels: { x: number; y: number; w: number; h: number }[] = [];
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              panels.push({
                x: EDGE_MARGIN + c * (cellW + PANEL_GAP),
                y: EDGE_MARGIN + r * (cellH + PANEL_GAP),
                w: cellW,
                h: cellH,
              });
            }
          }
          return panels;
        };

        // Layout templates matching TemplatesPanel.tsx
        const LAYOUT_PANELS: Record<string, { x: number; y: number; w: number; h: number }[]> = {
          'single': [{ x: EDGE_MARGIN, y: EDGE_MARGIN, w: 100 - 2 * EDGE_MARGIN, h: 100 - 2 * EDGE_MARGIN }],
          'two-horizontal': calcPanels({ cols: 1, rows: 2 }),
          'two-vertical': calcPanels({ cols: 2, rows: 1 }),
          'three-rows': calcPanels({ cols: 1, rows: 3 }),
          'grid-2x2': calcPanels({ cols: 2, rows: 2 }),
          'big-left': calcPanels({ cols: 3, rows: 2, spans: [
            { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
            { col: 2, row: 0, colSpan: 1, rowSpan: 1 },
            { col: 2, row: 1, colSpan: 1, rowSpan: 1 },
          ]}),
          'big-right': calcPanels({ cols: 3, rows: 2, spans: [
            { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
            { col: 0, row: 1, colSpan: 1, rowSpan: 1 },
            { col: 1, row: 0, colSpan: 2, rowSpan: 2 },
          ]}),
          'big-top': calcPanels({ cols: 2, rows: 3, spans: [
            { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
            { col: 0, row: 2, colSpan: 1, rowSpan: 1 },
            { col: 1, row: 2, colSpan: 1, rowSpan: 1 },
          ]}),
          'big-bottom': calcPanels({ cols: 2, rows: 3, spans: [
            { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
            { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
            { col: 0, row: 1, colSpan: 2, rowSpan: 2 },
          ]}),
          'strip-3': calcPanels({ cols: 3, rows: 1 }),
          'manga-3': calcPanels({ cols: 2, rows: 3, spans: [
            { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
            { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
            { col: 0, row: 1, colSpan: 2, rowSpan: 2 },
          ]}),
          'action': calcPanels({ cols: 3, rows: 5, spans: [
            { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
            { col: 2, row: 0, colSpan: 1, rowSpan: 2 },
            { col: 0, row: 2, colSpan: 3, rowSpan: 1 },
            { col: 0, row: 3, colSpan: 1, rowSpan: 2 },
            { col: 1, row: 3, colSpan: 2, rowSpan: 2 },
          ]}),
        };

        // Flatten all pages from all chapters into canvases
        const canvases: Canvas[] = [];
        let pageOrder = 0;
        const canvasW = PAPER_SIZES['A4'].width;
        const canvasH = PAPER_SIZES['A4'].height;
        const MARGIN = 20;
        const GAP = 16;
        const drawAreaW = canvasW - MARGIN * 2;
        const drawAreaH = canvasH - MARGIN * 2;

        for (const chapter of plan.chapters) {
          for (const page of chapter.pages) {
            const elements: CanvasElement[] = [];
            let zIndex = 1;

            // Get layout panels or fallback to grid
            const layoutPanels = LAYOUT_PANELS[page.layout] || calcPanels({ cols: 2, rows: Math.ceil(page.panels.length / 2) });

            for (const panel of page.panels) {
              const layoutPanel = layoutPanels[panel.position - 1];
              if (!layoutPanel) continue;

              // Convert percentages to pixels
              const x = Math.round(MARGIN + (layoutPanel.x / 100) * drawAreaW);
              const y = Math.round(MARGIN + (layoutPanel.y / 100) * drawAreaH);
              const w = Math.round((layoutPanel.w / 100) * drawAreaW - GAP);
              const h = Math.round((layoutPanel.h / 100) * drawAreaH - GAP);

              // Add image element (with generated image or placeholder)
              const imageElement: ImageElement = {
                id: createId(),
                type: 'image',
                x,
                y,
                width: w,
                height: h,
                rotation: 0,
                zIndex: zIndex++,
                imageUrl: panel.imageUrl || '',
                borderWidth: 4,
                borderColor: '#000000',
                borderStyle: 'clean',
                sepiaLevel: 0,
                clipPreset: 'none',
                customClipPath: null,
                showOverlay: true,
              };
              elements.push(imageElement);

              // ========================================
              // TEXT BLOCKS - Collision-aware placement
              // ========================================

              // Track placed text blocks for collision detection
              const placedBlocks: Array<{ x: number; y: number; w: number; h: number }> = [];

              // Check if a new block overlaps with any existing block
              const hasCollision = (nx: number, ny: number, nw: number, nh: number): boolean => {
                const padding = 4; // Min gap between blocks
                for (const block of placedBlocks) {
                  if (!(nx + nw + padding < block.x ||
                        nx > block.x + block.w + padding ||
                        ny + nh + padding < block.y ||
                        ny > block.y + block.h + padding)) {
                    return true;
                  }
                }
                return false;
              };

              // Convert TextPlacement to pixel coordinates within panel
              const placementToPixels = (
                placement: string,
                blockW: number,
                blockH: number
              ): { x: number; y: number; isTop: boolean; isLeft: boolean } => {
                const pad = 8;
                const parts = placement.split('-');
                const row = parts[0] as 'top' | 'middle' | 'bottom';
                const col = parts[1] as 'left' | 'center' | 'right';

                let px: number;
                let py: number;
                let isLeft = true;
                let isTop = true;

                switch (col) {
                  case 'left':
                    px = x + pad;
                    isLeft = true;
                    break;
                  case 'center':
                    px = x + Math.round((w - blockW) / 2);
                    isLeft = true; // for tail calculation
                    break;
                  case 'right':
                    px = x + w - blockW - pad;
                    isLeft = false;
                    break;
                  default:
                    px = x + pad;
                }

                switch (row) {
                  case 'top':
                    py = y + pad;
                    isTop = true;
                    break;
                  case 'middle':
                    py = y + Math.round((h - blockH) / 2);
                    isTop = true;
                    break;
                  case 'bottom':
                    py = y + h - blockH - pad;
                    isTop = false;
                    break;
                  default:
                    py = y + pad;
                }

                return { x: px, y: py, isTop, isLeft };
              };

              // Find non-overlapping position, trying multiple placements
              const findNonOverlappingPosition = (
                blockW: number,
                blockH: number,
                preferredPositions: Array<{ x: number; y: number; isTop?: boolean; isLeft?: boolean }>
              ): { x: number; y: number; isTop: boolean; isLeft: boolean } => {
                // Try each preferred position
                for (const pos of preferredPositions) {
                  if (!hasCollision(pos.x, pos.y, blockW, blockH)) {
                    return { x: pos.x, y: pos.y, isTop: pos.isTop ?? true, isLeft: pos.isLeft ?? true };
                  }
                }
                // If all overlap, return first position anyway
                const first = preferredPositions[0];
                return { x: first.x, y: first.y, isTop: first.isTop ?? true, isLeft: first.isLeft ?? true };
              };

              if (panel.narrative) {
                const text = panel.narrative;

                // Auto-size: estimate width/height based on text
                const maxWidth = Math.min(180, w * 0.45);
                const charWidth = 7;
                const lineHeight = 16;
                const padding = 16;

                const charsPerLine = Math.floor((maxWidth - padding * 2) / charWidth);
                const lines = Math.ceil(text.length / charsPerLine);

                const blockW = Math.min(maxWidth, text.length * charWidth + padding * 2);
                const blockH = lines * lineHeight + padding;

                // Check if LLM provided placement
                let px: number;
                let py: number;

                if (panel.narrativePlacement) {
                  // Use LLM-provided placement
                  const pos = placementToPixels(panel.narrativePlacement, blockW, blockH);
                  if (!hasCollision(pos.x, pos.y, blockW, blockH)) {
                    px = pos.x;
                    py = pos.y;
                  } else {
                    // LLM placement collides, use fallback
                    const pad = 8;
                    const candidatePositions = [
                      { x: x + pad, y: y + pad },
                      { x: x + w - blockW - pad, y: y + pad },
                      { x: x + Math.round((w - blockW) / 2), y: y + pad },
                      { x: x + pad, y: y + h - blockH - pad },
                    ];
                    const found = findNonOverlappingPosition(blockW, blockH, candidatePositions);
                    px = found.x;
                    py = found.y;
                  }
                } else {
                  // No LLM placement, use collision detection
                  const pad = 8;
                  const candidatePositions = [
                    { x: x + pad, y: y + pad },
                    { x: x + w - blockW - pad, y: y + pad },
                    { x: x + Math.round((w - blockW) / 2), y: y + pad },
                    { x: x + pad, y: y + h - blockH - pad },
                  ];
                  const found = findNonOverlappingPosition(blockW, blockH, candidatePositions);
                  px = found.x;
                  py = found.y;
                }

                placedBlocks.push({ x: px, y: py, w: blockW, h: blockH });

                elements.push({
                  id: createId(),
                  type: 'narrative',
                  x: px,
                  y: py,
                  width: blockW,
                  height: blockH,
                  rotation: 0,
                  zIndex: zIndex++,
                  text: text,
                  bgColor: stylePreset.narrative.bgColor,
                  textColor: stylePreset.narrative.textColor,
                  borderColor: stylePreset.narrative.borderColor,
                  borderWidth: 2,
                  fontSize: 12,
                  fontFamily: stylePreset.narrative.fontFamily,
                  padding: 10,
                } as NarrativeElement);
              }

              // Add dialogues if exist
              if (panel.dialogue && panel.dialogue.length > 0) {
                // Seeded random for consistent but varied placement
                const panelSeed = panel.position * 1000 + pageOrder * 100;
                const seededRandom = (i: number) => {
                  const sx = Math.sin(panelSeed + i * 127) * 10000;
                  return sx - Math.floor(sx);
                };

                // Bubble styles vary based on text content
                const getBubbleStyle = (text: string, di: number): BubbleStyle => {
                  // Shouting (exclamation marks, short text)
                  if (text.includes('!') && text.length < 30) return 'shout';
                  // Thinking/internal monologue (ellipsis or parentheses)
                  if (text.includes('...') || text.startsWith('(') || text.includes('думає')) return 'cloud';
                  // Whispering (quiet text)
                  if (text.toLowerCase().includes('шепоч') || text.toLowerCase().includes('тихо')) return 'whisper';
                  // Default: round or square
                  return seededRandom(di + 100) > 0.6 ? 'square' : 'round';
                };

                for (let di = 0; di < panel.dialogue.length; di++) {
                  const dlg = panel.dialogue[di];
                  const text = dlg.text;
                  const speaker = characterNames.get(dlg.characterId) || '';

                  // Auto-size dialogue bubble
                  const maxWidth = Math.min(160, w * 0.45);
                  const charWidth = 7;
                  const lineHeight = 16;
                  const padding = 12;
                  const speakerHeight = 14;

                  const charsPerLine = Math.floor((maxWidth - padding * 2) / charWidth);
                  const lines = Math.ceil(text.length / charsPerLine);

                  const blockW = Math.min(maxWidth, Math.max(60, text.length * charWidth / lines + padding * 2));
                  const blockH = lines * lineHeight + padding + speakerHeight;

                  const pad = 8;
                  let chosen: { x: number; y: number; isTop: boolean; isLeft: boolean };
                  let aiTailDirection: TailPosition | null = null;
                  let aiWidth: number | null = null;
                  let aiHeight: number | null = null;

                  // Priority 1: Use precise AI placement if available
                  if (dlg.precisePlacement) {
                    const pp = dlg.precisePlacement;
                    // Convert percentage to pixels
                    const preciseX = x + Math.round((pp.x / 100) * w);
                    const preciseY = y + Math.round((pp.y / 100) * h);
                    aiWidth = Math.round((pp.width / 100) * w);
                    aiHeight = Math.round((pp.height / 100) * h);
                    aiTailDirection = pp.tailDirection as TailPosition;

                    if (!hasCollision(preciseX, preciseY, aiWidth, aiHeight)) {
                      chosen = {
                        x: preciseX,
                        y: preciseY,
                        isTop: pp.y < 50,
                        isLeft: pp.x < 50,
                      };
                    } else {
                      // AI placement collides, use fallback
                      const patterns = [
                        { isTop: true, isLeft: true },
                        { isTop: false, isLeft: false },
                        { isTop: true, isLeft: false },
                        { isTop: false, isLeft: true },
                      ];
                      const candidatePositions = patterns.map(p => ({
                        x: p.isLeft ? x + pad : x + w - aiWidth! - pad,
                        y: p.isTop ? y + pad : y + h - aiHeight! - pad,
                        isTop: p.isTop,
                        isLeft: p.isLeft,
                      }));
                      chosen = findNonOverlappingPosition(aiWidth, aiHeight, candidatePositions);
                    }
                  }
                  // Priority 2: Use legacy 9-zone placement
                  else if (dlg.placement) {
                    // Use LLM-provided placement
                    const pos = placementToPixels(dlg.placement, blockW, blockH);
                    if (!hasCollision(pos.x, pos.y, blockW, blockH)) {
                      chosen = pos;
                    } else {
                      // LLM placement collides, find fallback
                      const patterns = [
                        { isTop: true, isLeft: true },
                        { isTop: false, isLeft: false },
                        { isTop: true, isLeft: false },
                        { isTop: false, isLeft: true },
                      ];
                      const candidatePositions = patterns.map(p => ({
                        x: p.isLeft ? x + pad : x + w - blockW - pad,
                        y: p.isTop ? y + pad : y + h - blockH - pad,
                        isTop: p.isTop,
                        isLeft: p.isLeft,
                      }));
                      chosen = findNonOverlappingPosition(blockW, blockH, candidatePositions);
                    }
                  }
                  // Priority 3: Fallback to collision-based placement
                  else {
                    // No LLM placement, use collision detection with pattern-based order
                    const patterns = [
                      { isTop: true, isLeft: true },   // 0: top-left
                      { isTop: false, isLeft: false }, // 1: bottom-right
                      { isTop: true, isLeft: false },  // 2: top-right
                      { isTop: false, isLeft: true },  // 3: bottom-left
                    ];
                    const pattern = patterns[di % patterns.length];

                    const candidatePositions: Array<{ x: number; y: number; isTop: boolean; isLeft: boolean }> = [];

                    // Add primary position first
                    candidatePositions.push({
                      x: pattern.isLeft ? x + pad : x + w - blockW - pad,
                      y: pattern.isTop ? y + pad : y + h - blockH - pad,
                      isTop: pattern.isTop,
                      isLeft: pattern.isLeft,
                    });

                    // Add fallback positions
                    for (const p of patterns) {
                      if (p !== pattern) {
                        candidatePositions.push({
                          x: p.isLeft ? x + pad : x + w - blockW - pad,
                          y: p.isTop ? y + pad : y + h - blockH - pad,
                          isTop: p.isTop,
                          isLeft: p.isLeft,
                        });
                      }
                    }

                    // Add center positions as last resort
                    candidatePositions.push(
                      { x: x + Math.round((w - blockW) / 2), y: y + pad, isTop: true, isLeft: true },
                      { x: x + Math.round((w - blockW) / 2), y: y + h - blockH - pad, isTop: false, isLeft: true }
                    );

                    chosen = findNonOverlappingPosition(blockW, blockH, candidatePositions);
                  }

                  // Use AI-provided dimensions or calculated ones
                  const finalWidth = aiWidth ?? blockW;
                  const finalHeight = aiHeight ?? blockH;

                  placedBlocks.push({ x: chosen.x, y: chosen.y, w: finalWidth, h: finalHeight });

                  // Use AI tail direction if available, otherwise calculate from position
                  let tailPosition: TailPosition = aiTailDirection ?? 'none';

                  if (!aiTailDirection || aiTailDirection === 'none') {
                    const panelCenterX = x + w / 2;
                    const bubbleCenterX = chosen.x + finalWidth / 2;

                    // Determine tail direction based on where panel center is relative to bubble
                    if (chosen.isTop) {
                      // Bubble is at top - tail should point down
                      if (bubbleCenterX < panelCenterX) {
                        tailPosition = 'bottom-right';
                      } else {
                        tailPosition = 'bottom-left';
                      }
                    } else {
                      // Bubble is at bottom - tail should point up
                      if (bubbleCenterX < panelCenterX) {
                        tailPosition = 'top-right';
                      } else {
                        tailPosition = 'top-left';
                      }
                    }
                  }

                  const bubbleStyle = getBubbleStyle(text, di);

                  elements.push({
                    id: createId(),
                    type: 'dialogue',
                    x: chosen.x,
                    y: chosen.y,
                    width: finalWidth,
                    height: finalHeight,
                    rotation: 0,
                    zIndex: zIndex++,
                    speaker: speaker,
                    text: text,
                    bgColor: stylePreset.dialogue.bgColor,
                    textColor: stylePreset.dialogue.textColor,
                    borderColor: stylePreset.dialogue.borderColor,
                    borderWidth: 2,
                    fontSize: 12,
                    tailPosition: tailPosition,
                    bubbleStyle: bubbleStyle,
                  } as DialogueElement);
                }
              }
            }

            const canvas: Canvas = {
              id: page.id,
              name: `Page ${page.pageNumber}`,
              elements,
              width: canvasW,
              height: canvasH,
              backgroundColor: '#ffffff',
              order: pageOrder++,
            };
            canvases.push(canvas);
          }
        }

        const project: EditorProject = {
          id: plan.id,
          title: plan.title,
          canvases,
          paperSize: 'A4',
          layout: 'horizontal',
          borderStyle: 'clean',
          createdAt: plan.createdAt,
          updatedAt: new Date().toISOString(),
        };

        saveProject(project);
        set({
          project,
          activeCanvasId: project.canvases[0]?.id || null,
          selectedIds: [],
          history: [{ canvases: project.canvases, timestamp: Date.now() }],
          historyIndex: 0,
        });
      } else {
        // Standard EditorProject format
        const project = parsed as EditorProject;
        saveProject(project);
        set({
          project,
          activeCanvasId: project.canvases?.[0]?.id || null,
          selectedIds: [],
          history: [{ canvases: project.canvases || [], timestamp: Date.now() }],
          historyIndex: 0,
        });
      }
    } catch (e) {
      console.error('Invalid JSON:', e);
    }
  },
}));
