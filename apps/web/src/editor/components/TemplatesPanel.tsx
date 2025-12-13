import { useEditorStore } from '../store';
import { ImageElement } from '../types';

interface Template {
  id: string;
  name: string;
  preview: React.ReactNode;
  panels: Array<{ x: number; y: number; w: number; h: number }>;
}

const createId = () => Math.random().toString(36).slice(2, 11);

// Templates defined as percentage-based layouts
const TEMPLATES: Template[] = [
  {
    id: 'single',
    name: 'Single',
    preview: (
      <div className="w-full h-full bg-[#555] rounded-sm" />
    ),
    panels: [
      { x: 0, y: 0, w: 100, h: 100 },
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
    panels: [
      { x: 0, y: 0, w: 100, h: 48 },
      { x: 0, y: 52, w: 100, h: 48 },
    ],
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
    panels: [
      { x: 0, y: 0, w: 48, h: 100 },
      { x: 52, y: 0, w: 48, h: 100 },
    ],
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
    panels: [
      { x: 0, y: 0, w: 100, h: 31 },
      { x: 0, y: 34, w: 100, h: 32 },
      { x: 0, y: 68, w: 100, h: 32 },
    ],
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
    panels: [
      { x: 0, y: 0, w: 48, h: 48 },
      { x: 52, y: 0, w: 48, h: 48 },
      { x: 0, y: 52, w: 48, h: 48 },
      { x: 52, y: 52, w: 48, h: 48 },
    ],
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
    panels: [
      { x: 0, y: 0, w: 64, h: 100 },
      { x: 68, y: 0, w: 32, h: 48 },
      { x: 68, y: 52, w: 32, h: 48 },
    ],
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
    panels: [
      { x: 0, y: 0, w: 32, h: 48 },
      { x: 0, y: 52, w: 32, h: 48 },
      { x: 36, y: 0, w: 64, h: 100 },
    ],
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
    panels: [
      { x: 0, y: 0, w: 100, h: 64 },
      { x: 0, y: 68, w: 48, h: 32 },
      { x: 52, y: 68, w: 48, h: 32 },
    ],
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
    panels: [
      { x: 0, y: 0, w: 48, h: 32 },
      { x: 52, y: 0, w: 48, h: 32 },
      { x: 0, y: 36, w: 100, h: 64 },
    ],
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
    panels: [
      { x: 0, y: 0, w: 31, h: 100 },
      { x: 34, y: 0, w: 32, h: 100 },
      { x: 68, y: 0, w: 32, h: 100 },
    ],
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
    panels: [
      { x: 0, y: 0, w: 48, h: 32 },
      { x: 52, y: 0, w: 48, h: 32 },
      { x: 0, y: 36, w: 100, h: 64 },
    ],
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
    panels: [
      { x: 0, y: 0, w: 64, h: 38 },
      { x: 68, y: 0, w: 32, h: 38 },
      { x: 0, y: 42, w: 100, h: 16 },
      { x: 0, y: 62, w: 32, h: 38 },
      { x: 36, y: 62, w: 64, h: 38 },
    ],
  },
];

export const TemplatesPanel = () => {
  const { getActiveCanvas, addElements } = useEditorStore();
  const activeCanvas = getActiveCanvas();

  const applyTemplate = (template: Template) => {
    if (!activeCanvas) return;

    const MARGIN = 20;
    const GAP = 16;
    
    const canvasW = activeCanvas.width - MARGIN * 2;
    const canvasH = activeCanvas.height - MARGIN * 2;
    const baseZIndex = activeCanvas.elements.length;

    const elements: ImageElement[] = template.panels.map((panel, i) => {
      const x = MARGIN + (panel.x / 100) * canvasW;
      const y = MARGIN + (panel.y / 100) * canvasH;
      const w = (panel.w / 100) * canvasW - GAP;
      const h = (panel.h / 100) * canvasH - GAP;

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
        sepiaLevel: 0,
        clipVariant: 0,
        showOverlay: false,
      };
    });

    addElements(elements);
  };

  return (
    <div className="space-y-3">
      <label className="text-[#888] text-sm">Page Templates</label>
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
      <p className="text-[#555] text-xs">
        Click to add panels to current page
      </p>
    </div>
  );
};

