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
  sepiaLevel: 0.15,
  clipVariant: 0,
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
      const project = JSON.parse(json) as EditorProject;
      saveProject(project);
      set({ 
        project, 
        activeCanvasId: project.canvases?.[0]?.id || null,
        selectedIds: [],
        history: [{ canvases: project.canvases || [], timestamp: Date.now() }],
        historyIndex: 0,
      });
    } catch (e) {
      console.error('Invalid JSON');
    }
  },
}));
