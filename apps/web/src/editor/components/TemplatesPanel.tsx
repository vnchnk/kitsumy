import { useState } from 'react';
import { useEditorStore } from '../store';
import { ImageElement, ClipPreset } from '../types';
import { Shuffle, Link } from 'lucide-react';

interface Panel {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Template {
  id: string;
  name: string;
  preview: React.ReactNode;
  panels: Panel[];
}

const createId = () => Math.random().toString(36).slice(2, 11);

// Slant amount in percentage (small for subtle effect)
const SLANT = 4;

// Generate matched clip paths with uniform gaps
const generateMatchedClipPaths = (panels: Panel[]): (number[][] | null)[] => {
  // Find shared edges between panels (accounting for PANEL_GAP between them)
  // Key: string representation of edge position, Value: slant offsets
  type EdgeSlant = { leftOffset: number; rightOffset: number } | { topOffset: number; bottomOffset: number };
  
  // Store edges by their approximate position (midpoint of gap between panels)
  const sharedHEdges: { y: number; slant: { leftOffset: number; rightOffset: number }; panels: Set<number> }[] = [];
  const sharedVEdges: { x: number; slant: { topOffset: number; bottomOffset: number }; panels: Set<number> }[] = [];
  
  // Find pairs of panels that share an edge
  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      const pi = panels[i];
      const pj = panels[j];
      
      const piBottom = pi.y + pi.h;
      const piRight = pi.x + pi.w;
      const pjBottom = pj.y + pj.h;
      const pjRight = pj.x + pj.w;
      
      // Check horizontal adjacency (one above the other)
      // pi's bottom + GAP ≈ pj's top OR pj's bottom + GAP ≈ pi's top
      const hGap1 = Math.abs(piBottom + PANEL_GAP - pj.y);
      const hGap2 = Math.abs(pjBottom + PANEL_GAP - pi.y);
      
      if (hGap1 < 1) {
        // pi is above pj
        const edgeY = (piBottom + pj.y) / 2;
        let edge = sharedHEdges.find(e => Math.abs(e.y - edgeY) < 1);
        if (!edge) {
          edge = { y: edgeY, slant: { leftOffset: (Math.random() - 0.5) * SLANT * 2, rightOffset: (Math.random() - 0.5) * SLANT * 2 }, panels: new Set() };
          sharedHEdges.push(edge);
        }
        edge.panels.add(i);
        edge.panels.add(j);
      } else if (hGap2 < 1) {
        // pj is above pi
        const edgeY = (pjBottom + pi.y) / 2;
        let edge = sharedHEdges.find(e => Math.abs(e.y - edgeY) < 1);
        if (!edge) {
          edge = { y: edgeY, slant: { leftOffset: (Math.random() - 0.5) * SLANT * 2, rightOffset: (Math.random() - 0.5) * SLANT * 2 }, panels: new Set() };
          sharedHEdges.push(edge);
        }
        edge.panels.add(i);
        edge.panels.add(j);
      }
      
      // Check vertical adjacency (one left of the other)
      const vGap1 = Math.abs(piRight + PANEL_GAP - pj.x);
      const vGap2 = Math.abs(pjRight + PANEL_GAP - pi.x);
      
      if (vGap1 < 1) {
        // pi is left of pj
        const edgeX = (piRight + pj.x) / 2;
        let edge = sharedVEdges.find(e => Math.abs(e.x - edgeX) < 1);
        if (!edge) {
          edge = { x: edgeX, slant: { topOffset: (Math.random() - 0.5) * SLANT * 2, bottomOffset: (Math.random() - 0.5) * SLANT * 2 }, panels: new Set() };
          sharedVEdges.push(edge);
        }
        edge.panels.add(i);
        edge.panels.add(j);
      } else if (vGap2 < 1) {
        // pj is left of pi
        const edgeX = (pjRight + pi.x) / 2;
        let edge = sharedVEdges.find(e => Math.abs(e.x - edgeX) < 1);
        if (!edge) {
          edge = { x: edgeX, slant: { topOffset: (Math.random() - 0.5) * SLANT * 2, bottomOffset: (Math.random() - 0.5) * SLANT * 2 }, panels: new Set() };
          sharedVEdges.push(edge);
        }
        edge.panels.add(i);
        edge.panels.add(j);
      }
    }
  }
  
  return panels.map((panel, idx) => {
    const panelBottom = panel.y + panel.h;
    const panelRight = panel.x + panel.w;
    
    // Find shared edges for this panel
    const findTopEdge = () => sharedHEdges.find(e => e.panels.has(idx) && Math.abs(e.y - panel.y) < PANEL_GAP + 1);
    const findBottomEdge = () => sharedHEdges.find(e => e.panels.has(idx) && Math.abs(e.y - panelBottom) < PANEL_GAP + 1);
    const findLeftEdge = () => sharedVEdges.find(e => e.panels.has(idx) && Math.abs(e.x - panel.x) < PANEL_GAP + 1);
    const findRightEdge = () => sharedVEdges.find(e => e.panels.has(idx) && Math.abs(e.x - panelRight) < PANEL_GAP + 1);
    
    // Get slants (shared or random for canvas edges)
    const topEdge = findTopEdge();
    const bottomEdge = findBottomEdge();
    const leftEdge = findLeftEdge();
    const rightEdge = findRightEdge();
    
    const topSlant = topEdge?.slant || { leftOffset: (Math.random() - 0.5) * SLANT, rightOffset: (Math.random() - 0.5) * SLANT };
    const bottomSlant = bottomEdge?.slant || { leftOffset: (Math.random() - 0.5) * SLANT, rightOffset: (Math.random() - 0.5) * SLANT };
    const leftSlant = leftEdge?.slant || { topOffset: (Math.random() - 0.5) * SLANT, bottomOffset: (Math.random() - 0.5) * SLANT };
    const rightSlant = rightEdge?.slant || { topOffset: (Math.random() - 0.5) * SLANT, bottomOffset: (Math.random() - 0.5) * SLANT };
    
    // Build corners
    const BASE_MIN = 2;
    const BASE_MAX = 98;
    
    const tl_x = BASE_MIN + (leftSlant as { topOffset: number; bottomOffset: number }).topOffset;
    const tl_y = BASE_MIN + (topSlant as { leftOffset: number; rightOffset: number }).leftOffset;
    
    const tr_x = BASE_MAX + (rightSlant as { topOffset: number; bottomOffset: number }).topOffset;
    const tr_y = BASE_MIN + (topSlant as { leftOffset: number; rightOffset: number }).rightOffset;
    
    const br_x = BASE_MAX + (rightSlant as { topOffset: number; bottomOffset: number }).bottomOffset;
    const br_y = BASE_MAX + (bottomSlant as { leftOffset: number; rightOffset: number }).rightOffset;
    
    const bl_x = BASE_MIN + (leftSlant as { topOffset: number; bottomOffset: number }).bottomOffset;
    const bl_y = BASE_MAX + (bottomSlant as { leftOffset: number; rightOffset: number }).leftOffset;
    
    return [
      [Math.round(tl_x), Math.round(tl_y)],
      [Math.round(tr_x), Math.round(tr_y)],
      [Math.round(br_x), Math.round(br_y)],
      [Math.round(bl_x), Math.round(bl_y)],
    ];
  });
};

// Simple random presets (non-matched)
const RANDOM_CLIP_PRESETS: ClipPreset[] = [
  'none',
  'slight-1',
  'slight-2', 
  'slight-3',
  'trapezoid-left',
  'trapezoid-right',
  'trapezoid-top',
  'trapezoid-bottom',
  'parallelogram-right',
  'parallelogram-left',
  'slant-right',
  'slant-left',
];

const getRandomClipPreset = (): ClipPreset => {
  return RANDOM_CLIP_PRESETS[Math.floor(Math.random() * RANDOM_CLIP_PRESETS.length)];
};

// Layout constants - uniform margins from all edges
const EDGE_MARGIN = 1.5; // margin from canvas edges (%)
const PANEL_GAP = 2;     // gap between panels (%)

// Helper to calculate panel positions with uniform margins
const calcPanels = (layout: { cols: number; rows: number; spans?: { col: number; row: number; colSpan: number; rowSpan: number }[] }): Panel[] => {
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
  
  const panels: Panel[] = [];
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

// Templates defined as percentage-based layouts
const TEMPLATES: Template[] = [
  {
    id: 'single',
    name: 'Single',
    preview: (
      <div className="w-full h-full bg-[#555] rounded-sm" />
    ),
    panels: [
      { x: EDGE_MARGIN, y: EDGE_MARGIN, w: 100 - 2 * EDGE_MARGIN, h: 100 - 2 * EDGE_MARGIN },
    ],
  },
  {
    id: 'two-horizontal',
    name: '2 Horizontal',
    preview: (
      <div className="w-full h-full flex flex-col gap-0.5">
        <div className="flex-1 bg-[#555] rounded-sm" />
        <div className="flex-1 bg-[#555] rounded-sm" />
      </div>
    ),
    panels: calcPanels({ cols: 1, rows: 2 }),
  },
  {
    id: 'two-vertical',
    name: '2 Vertical',
    preview: (
      <div className="w-full h-full flex gap-0.5">
        <div className="flex-1 bg-[#555] rounded-sm" />
        <div className="flex-1 bg-[#555] rounded-sm" />
      </div>
    ),
    panels: calcPanels({ cols: 2, rows: 1 }),
  },
  {
    id: 'three-rows',
    name: '3 Rows',
    preview: (
      <div className="w-full h-full flex flex-col gap-0.5">
        <div className="flex-1 bg-[#555] rounded-sm" />
        <div className="flex-1 bg-[#555] rounded-sm" />
        <div className="flex-1 bg-[#555] rounded-sm" />
      </div>
    ),
    panels: calcPanels({ cols: 1, rows: 3 }),
  },
  {
    id: 'grid-2x2',
    name: 'Grid 2×2',
    preview: (
      <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5">
        <div className="bg-[#555] rounded-sm" />
        <div className="bg-[#555] rounded-sm" />
        <div className="bg-[#555] rounded-sm" />
        <div className="bg-[#555] rounded-sm" />
      </div>
    ),
    panels: calcPanels({ cols: 2, rows: 2 }),
  },
  {
    id: 'big-left',
    name: 'Big Left',
    preview: (
      <div className="w-full h-full flex gap-0.5">
        <div className="w-2/3 bg-[#555] rounded-sm" />
        <div className="w-1/3 flex flex-col gap-0.5">
          <div className="flex-1 bg-[#555] rounded-sm" />
          <div className="flex-1 bg-[#555] rounded-sm" />
        </div>
      </div>
    ),
    panels: calcPanels({ cols: 3, rows: 2, spans: [
      { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
      { col: 2, row: 0, colSpan: 1, rowSpan: 1 },
      { col: 2, row: 1, colSpan: 1, rowSpan: 1 },
    ]}),
  },
  {
    id: 'big-right',
    name: 'Big Right',
    preview: (
      <div className="w-full h-full flex gap-0.5">
        <div className="w-1/3 flex flex-col gap-0.5">
          <div className="flex-1 bg-[#555] rounded-sm" />
          <div className="flex-1 bg-[#555] rounded-sm" />
        </div>
        <div className="w-2/3 bg-[#555] rounded-sm" />
      </div>
    ),
    panels: calcPanels({ cols: 3, rows: 2, spans: [
      { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      { col: 0, row: 1, colSpan: 1, rowSpan: 1 },
      { col: 1, row: 0, colSpan: 2, rowSpan: 2 },
    ]}),
  },
  {
    id: 'big-top',
    name: 'Big Top',
    preview: (
      <div className="w-full h-full flex flex-col gap-0.5">
        <div className="h-2/3 bg-[#555] rounded-sm" />
        <div className="h-1/3 flex gap-0.5">
          <div className="flex-1 bg-[#555] rounded-sm" />
          <div className="flex-1 bg-[#555] rounded-sm" />
        </div>
      </div>
    ),
    panels: calcPanels({ cols: 2, rows: 3, spans: [
      { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
      { col: 0, row: 2, colSpan: 1, rowSpan: 1 },
      { col: 1, row: 2, colSpan: 1, rowSpan: 1 },
    ]}),
  },
  {
    id: 'big-bottom',
    name: 'Big Bottom',
    preview: (
      <div className="w-full h-full flex flex-col gap-0.5">
        <div className="h-1/3 flex gap-0.5">
          <div className="flex-1 bg-[#555] rounded-sm" />
          <div className="flex-1 bg-[#555] rounded-sm" />
        </div>
        <div className="h-2/3 bg-[#555] rounded-sm" />
      </div>
    ),
    panels: calcPanels({ cols: 2, rows: 3, spans: [
      { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
      { col: 0, row: 1, colSpan: 2, rowSpan: 2 },
    ]}),
  },
  {
    id: 'strip-3',
    name: '3 Strip',
    preview: (
      <div className="w-full h-full flex gap-0.5">
        <div className="flex-1 bg-[#555] rounded-sm" />
        <div className="flex-1 bg-[#555] rounded-sm" />
        <div className="flex-1 bg-[#555] rounded-sm" />
      </div>
    ),
    panels: calcPanels({ cols: 3, rows: 1 }),
  },
  {
    id: 'manga-3',
    name: 'Manga 3',
    preview: (
      <div className="w-full h-full flex flex-col gap-0.5">
        <div className="h-1/3 flex gap-0.5">
          <div className="w-1/2 bg-[#555] rounded-sm" />
          <div className="w-1/2 bg-[#555] rounded-sm" />
        </div>
        <div className="h-2/3 bg-[#555] rounded-sm" />
      </div>
    ),
    panels: calcPanels({ cols: 2, rows: 3, spans: [
      { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
      { col: 0, row: 1, colSpan: 2, rowSpan: 2 },
    ]}),
  },
  {
    id: 'action',
    name: 'Action',
    preview: (
      <div className="w-full h-full flex flex-col gap-0.5">
        <div className="h-2/5 flex gap-0.5">
          <div className="w-2/3 bg-[#555] rounded-sm" />
          <div className="w-1/3 bg-[#555] rounded-sm" />
        </div>
        <div className="h-1/5 bg-[#555] rounded-sm" />
        <div className="h-2/5 flex gap-0.5">
          <div className="w-1/3 bg-[#555] rounded-sm" />
          <div className="w-2/3 bg-[#555] rounded-sm" />
        </div>
      </div>
    ),
    panels: calcPanels({ cols: 3, rows: 5, spans: [
      { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
      { col: 2, row: 0, colSpan: 1, rowSpan: 2 },
      { col: 0, row: 2, colSpan: 3, rowSpan: 1 },
      { col: 0, row: 3, colSpan: 1, rowSpan: 2 },
      { col: 1, row: 3, colSpan: 2, rowSpan: 2 },
    ]}),
  },
];

type ShapeMode = 'none' | 'random' | 'matched';

// Persist shape mode in localStorage
const getStoredShapeMode = (): ShapeMode => {
  const stored = localStorage.getItem('kitsumy-shape-mode');
  if (stored === 'random' || stored === 'matched' || stored === 'none') return stored;
  return 'none';
};

// Generate random non-overlapping panels using recursive subdivision
const generateRandomPanels = (count: number): Panel[] => {
  interface Rect { x: number; y: number; w: number; h: number; }
  
  const MIN_WIDTH = 25;  // Minimum 25% width
  const MIN_HEIGHT = 20; // Minimum 20% height
  
  // Start with area inside margins
  const availableW = 100 - 2 * EDGE_MARGIN;
  const availableH = 100 - 2 * EDGE_MARGIN;
  const regions: Rect[] = [{ x: EDGE_MARGIN, y: EDGE_MARGIN, w: availableW, h: availableH }];
  
  // Subdivide until we have enough regions
  while (regions.length < count) {
    // Find largest region to split
    regions.sort((a, b) => (b.w * b.h) - (a.w * a.h));
    const region = regions.shift()!;
    
    // Check if we can split while maintaining minimum sizes
    const canSplitVertically = region.w >= MIN_WIDTH * 2;
    const canSplitHorizontally = region.h >= MIN_HEIGHT * 2;
    
    if (!canSplitVertically && !canSplitHorizontally) {
      // Can't split anymore, put it back
      regions.push(region);
      break;
    }
    
    // Decide split direction based on what's possible and aspect ratio
    let splitVertically: boolean;
    if (canSplitVertically && canSplitHorizontally) {
      // Both possible - prefer splitting the longer dimension
      splitVertically = region.w > region.h * 1.2 
        ? Math.random() > 0.2 
        : Math.random() > 0.8;
    } else {
      splitVertically = canSplitVertically;
    }
    
    if (splitVertically) {
      // Split vertically (create left and right) with gap
      const effectiveW = region.w - PANEL_GAP;
      const minSplit = MIN_WIDTH / effectiveW * 100;
      const maxSplit = 100 - minSplit;
      const splitPoint = minSplit + Math.random() * (maxSplit - minSplit);
      const leftW = effectiveW * (splitPoint / 100);
      
      regions.push({ x: region.x, y: region.y, w: leftW, h: region.h });
      regions.push({ x: region.x + leftW + PANEL_GAP, y: region.y, w: effectiveW - leftW, h: region.h });
    } else {
      // Split horizontally (create top and bottom) with gap
      const effectiveH = region.h - PANEL_GAP;
      const minSplit = MIN_HEIGHT / effectiveH * 100;
      const maxSplit = 100 - minSplit;
      const splitPoint = minSplit + Math.random() * (maxSplit - minSplit);
      const topH = effectiveH * (splitPoint / 100);
      
      regions.push({ x: region.x, y: region.y, w: region.w, h: topH });
      regions.push({ x: region.x, y: region.y + topH + PANEL_GAP, w: region.w, h: effectiveH - topH });
    }
  }
  
  // Take exactly the number we need
  const selectedRegions = regions.slice(0, count);
  
  // Add small gaps between panels
  const GAP = 2;
  return selectedRegions.map(r => ({
    x: r.x + GAP / 2,
    y: r.y + GAP / 2,
    w: r.w - GAP,
    h: r.h - GAP,
  }));
};

export const TemplatesPanel = () => {
  const { getActiveCanvas, addElements } = useEditorStore();
  const activeCanvas = getActiveCanvas();
  const [shapeMode, setShapeModeState] = useState<ShapeMode>(getStoredShapeMode);
  const [randomCount, setRandomCount] = useState(5);
  
  // Persist shape mode
  const setShapeMode = (mode: ShapeMode) => {
    setShapeModeState(mode);
    localStorage.setItem('kitsumy-shape-mode', mode);
  };

  const applyTemplate = (template: Template) => {
    if (!activeCanvas) return;

    const MARGIN = 20;
    const GAP = 16;
    
    const canvasW = activeCanvas.width - MARGIN * 2;
    const canvasH = activeCanvas.height - MARGIN * 2;
    const baseZIndex = activeCanvas.elements.length;

    // Generate matched clip paths if needed
    const matchedClipPaths = shapeMode === 'matched' 
      ? generateMatchedClipPaths(template.panels) 
      : null;

    const elements: ImageElement[] = template.panels.map((panel, i) => {
      const x = MARGIN + (panel.x / 100) * canvasW;
      const y = MARGIN + (panel.y / 100) * canvasH;
      const w = (panel.w / 100) * canvasW - GAP;
      const h = (panel.h / 100) * canvasH - GAP;

      let clipPreset: ClipPreset = 'none';
      let customClipPath: number[][] | null = null;

      if (shapeMode === 'random') {
        clipPreset = getRandomClipPreset();
      } else if (shapeMode === 'matched' && matchedClipPaths) {
        customClipPath = matchedClipPaths[i];
      }

      return {
        id: createId(),
        type: 'image',
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(w),
        height: Math.round(h),
        rotation: 0,
        zIndex: baseZIndex + i + 1,
        imageUrl: '',
        borderWidth: 3,
        borderColor: '#000000',
        borderStyle: 'clean',
        sepiaLevel: 0,
        clipPreset,
        customClipPath,
        showOverlay: false,
      };
    });

    addElements(elements);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[#888] text-sm">Page Templates</label>
        <div className="flex gap-1">
          <button
            onClick={() => setShapeMode(shapeMode === 'random' ? 'none' : 'random')}
            title="Random shapes (independent)"
            className={`flex items-center gap-1 px-1.5 py-1 rounded text-xs transition-colors ${
              shapeMode === 'random'
                ? 'bg-[#3b82f6] text-white' 
                : 'bg-[#252525] text-[#888] hover:text-white'
            }`}
          >
            <Shuffle size={12} />
          </button>
          <button
            onClick={() => setShapeMode(shapeMode === 'matched' ? 'none' : 'matched')}
            title="Matched shapes (equal gaps)"
            className={`flex items-center gap-1 px-1.5 py-1 rounded text-xs transition-colors ${
              shapeMode === 'matched'
                ? 'bg-[#22c55e] text-white' 
                : 'bg-[#252525] text-[#888] hover:text-white'
            }`}
          >
            <Link size={12} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            onClick={() => applyTemplate(template)}
            className="aspect-[3/4] p-1.5 bg-[#252525] hover:bg-[#333] rounded-lg border border-[#333] hover:border-[#555] transition-colors group"
            title={template.name}
          >
            <div className="w-full h-full">
              {template.preview}
            </div>
          </button>
        ))}
      </div>
      
      {/* Random layout generator */}
      <div className="border-t border-[#333] pt-3 space-y-2">
        <label className="text-[#888] text-sm">Random Layout</label>
        <div className="flex gap-2">
          <input
            type="number"
            min={2}
            max={12}
            value={randomCount}
            onChange={(e) => setRandomCount(Math.max(2, Math.min(12, Number(e.target.value))))}
            className="w-16 bg-[#252525] text-white text-sm px-2 py-1.5 rounded border border-[#333] focus:border-[#3b82f6] outline-none"
          />
          <button
            onClick={() => {
              const randomPanels = generateRandomPanels(randomCount);
              applyTemplate({ id: 'random', name: 'Random', preview: null, panels: randomPanels });
            }}
            className="flex-1 bg-[#252525] hover:bg-[#333] text-[#888] hover:text-white text-sm py-1.5 px-3 rounded border border-[#333] hover:border-[#555] transition-colors"
          >
            Generate {randomCount} panels
          </button>
        </div>
      </div>
    </div>
  );
};

