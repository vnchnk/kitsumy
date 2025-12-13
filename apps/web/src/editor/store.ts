import { create } from 'zustand';
import {
  EditorProject,
  Tool,
  CanvasElement,
  ElementType,
  ImageElement,
  NarrativeElement,
  DialogueElement,
} from './types';

interface HistoryEntry {
  elements: CanvasElement[];
  timestamp: number;
}

interface EditorState {
  project: EditorProject | null;
  selectedIds: string[];
  tool: Tool;
  zoom: number;
  panOffset: { x: number; y: number };
  
  // Undo/Redo
  history: HistoryEntry[];
  historyIndex: number;

  // Actions
  initProject: (id: string) => void;
  setProjectTitle: (title: string) => void;
  setCanvasSize: (width: number, height: number) => void;
  setBackgroundColor: (color: string) => void;

  // Element actions
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

const saveProject = (project: EditorProject) => {
  localStorage.setItem(`kitsumy-project-${project.id}`, JSON.stringify(project));
};

const MAX_HISTORY = 50;

const pushHistory = (state: EditorState, elements: CanvasElement[]): Partial<EditorState> => {
  // Remove any redo history after current index
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  // Add new entry
  newHistory.push({ elements: JSON.parse(JSON.stringify(elements)), timestamp: Date.now() });
  // Limit history size
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
  selectedIds: [],
  tool: 'select',
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  history: [],
  historyIndex: -1,

  initProject: (id) => {
    const saved = localStorage.getItem(`kitsumy-project-${id}`);
    if (saved) {
      const project = JSON.parse(saved);
      // Migration from old panel-based format
      if (project.panels && !project.elements) {
        const elements: CanvasElement[] = [];
        let zIndex = 0;
        project.panels.forEach((panel: any) => {
          // Convert panel to image element
          elements.push({
            ...createDefaultImage(panel.x, panel.y, zIndex++),
            width: panel.width,
            height: panel.height,
            rotation: panel.rotation || 0,
            imageUrl: panel.imageUrl || '',
            sepiaLevel: panel.sepiaLevel || 0.15,
            clipVariant: panel.clipVariant || 0,
          });
          // Convert panel elements
          if (panel.elements) {
            panel.elements.forEach((el: any) => {
              if (el.type === 'narrative') {
                elements.push({
                  ...createDefaultNarrative(
                    panel.x + (panel.width * el.x) / 100,
                    panel.y + (panel.height * el.y) / 100,
                    zIndex++
                  ),
                  text: el.text,
                  bgColor: el.bgColor || '#fff133',
                  textColor: el.textColor || '#000000',
                  borderColor: el.borderColor || '#000000',
                  fontSize: el.fontSize || 14,
                  rotation: el.rotation || -1,
                });
              } else if (el.type === 'dialogue') {
                elements.push({
                  ...createDefaultDialogue(
                    panel.x + (panel.width * el.x) / 100,
                    panel.y + (panel.height * el.y) / 100,
                    zIndex++
                  ),
                  speaker: el.speaker || 'CHARACTER',
                  text: el.text,
                  bgColor: el.bgColor || '#ffffff',
                  textColor: el.textColor || '#000000',
                  borderColor: el.borderColor || '#000000',
                  fontSize: el.fontSize || 14,
                  rotation: el.rotation || 0,
                  tailPosition: el.tailPosition || 'bottom-left',
                });
              }
            });
          }
        });
        project.elements = elements;
        delete project.panels;
        project.backgroundColor = project.backgroundColor || '#1a1a1a';
      }
      const initialHistory = [{ elements: JSON.parse(JSON.stringify(project.elements)), timestamp: Date.now() }];
      set({ project, history: initialHistory, historyIndex: 0 });
    } else {
      set({
        project: {
          id,
          title: 'Untitled Comic',
          elements: [],
          canvasWidth: 2400,
          canvasHeight: 3200,
          backgroundColor: '#1a1a1a',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        history: [{ elements: [], timestamp: Date.now() }],
        historyIndex: 0,
      });
    }
  },

  setProjectTitle: (title) => {
    set((state) => {
      if (!state.project) return state;
      const updated = { ...state.project, title, updatedAt: new Date().toISOString() };
      saveProject(updated);
      return { project: updated };
    });
  },

  setCanvasSize: (width, height) => {
    set((state) => {
      if (!state.project) return state;
      const updated = {
        ...state.project,
        canvasWidth: width,
        canvasHeight: height,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { project: updated };
    });
  },

  setBackgroundColor: (color) => {
    set((state) => {
      if (!state.project) return state;
      const updated = { ...state.project, backgroundColor: color, updatedAt: new Date().toISOString() };
      saveProject(updated);
      return { project: updated };
    });
  },

  addElement: (type, x, y) => {
    set((state) => {
      if (!state.project) return state;
      const zIndex = getMaxZIndex(state.project.elements) + 1;
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

      const newElements = [...state.project.elements, newElement];
      const updated = {
        ...state.project,
        elements: newElements,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { project: updated, selectedIds: [newElement.id], tool: 'select', ...pushHistory(state, newElements) };
    });
  },

  updateElement: (id, updates) => {
    set((state) => {
      if (!state.project) return state;
      const updated = {
        ...state.project,
        elements: state.project.elements.map((el) =>
          el.id === id ? { ...el, ...updates } : el
        ) as CanvasElement[],
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { project: updated };
    });
  },

  deleteElement: (id) => {
    set((state) => {
      if (!state.project) return state;
      const newElements = state.project.elements.filter((el) => el.id !== id);
      const updated = {
        ...state.project,
        elements: newElements,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return {
        project: updated,
        selectedIds: state.selectedIds.filter((sid) => sid !== id),
        ...pushHistory(state, newElements),
      };
    });
  },

  deleteSelected: () => {
    set((state) => {
      if (!state.project || state.selectedIds.length === 0) return state;
      const newElements = state.project.elements.filter((el) => !state.selectedIds.includes(el.id));
      const updated = {
        ...state.project,
        elements: newElements,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { project: updated, selectedIds: [], ...pushHistory(state, newElements) };
    });
  },

  select: (id, addToSelection = false) => {
    set((state) => {
      if (addToSelection) {
        const isSelected = state.selectedIds.includes(id);
        return {
          selectedIds: isSelected
            ? state.selectedIds.filter((sid) => sid !== id)
            : [...state.selectedIds, id],
        };
      }
      return { selectedIds: [id] };
    });
  },

  selectAll: () => {
    set((state) => {
      if (!state.project) return state;
      return { selectedIds: state.project.elements.map((el) => el.id) };
    });
  },

  clearSelection: () => set({ selectedIds: [] }),

  duplicateSelected: () => {
    set((state) => {
      if (!state.project || state.selectedIds.length === 0) return state;
      const maxZ = getMaxZIndex(state.project.elements);
      const newElements: CanvasElement[] = [];
      const newIds: string[] = [];

      state.selectedIds.forEach((id, i) => {
        const el = state.project!.elements.find((e) => e.id === id);
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

      const allElements = [...state.project.elements, ...newElements];
      const updated = {
        ...state.project,
        elements: allElements,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { project: updated, selectedIds: newIds, ...pushHistory(state, allElements) };
    });
  },

  bringToFront: (id) => {
    set((state) => {
      if (!state.project) return state;
      const maxZ = getMaxZIndex(state.project.elements);
      const updated = {
        ...state.project,
        elements: state.project.elements.map((el) =>
          el.id === id ? { ...el, zIndex: maxZ + 1 } : el
        ) as CanvasElement[],
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { project: updated };
    });
  },

  sendToBack: (id) => {
    set((state) => {
      if (!state.project) return state;
      const minZ = Math.min(...state.project.elements.map((el) => el.zIndex));
      const updated = {
        ...state.project,
        elements: state.project.elements.map((el) =>
          el.id === id ? { ...el, zIndex: minZ - 1 } : el
        ) as CanvasElement[],
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { project: updated };
    });
  },

  moveUp: (id) => {
    set((state) => {
      if (!state.project) return state;
      const el = state.project.elements.find((e) => e.id === id);
      if (!el) return state;
      const updated = {
        ...state.project,
        elements: state.project.elements.map((e) =>
          e.id === id ? { ...e, zIndex: e.zIndex + 1 } : e
        ) as CanvasElement[],
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return { project: updated };
    });
  },

  moveDown: (id) => {
    set((state) => {
      if (!state.project) return state;
      const el = state.project.elements.find((e) => e.id === id);
      if (!el) return state;
      const updated = {
        ...state.project,
        elements: state.project.elements.map((e) =>
          e.id === id ? { ...e, zIndex: Math.max(0, e.zIndex - 1) } : e
        ) as CanvasElement[],
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
        elements: JSON.parse(JSON.stringify(historyEntry.elements)),
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
        elements: JSON.parse(JSON.stringify(historyEntry.elements)),
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
      return pushHistory(state, state.project.elements);
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
      set({ project, selectedIds: [] });
    } catch (e) {
      console.error('Invalid JSON');
    }
  },
}));
