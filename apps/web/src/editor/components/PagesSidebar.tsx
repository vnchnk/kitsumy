import { useEditorStore } from '../store';
import { PAPER_SIZES, PaperSize, CanvasLayout } from '../types';
import { Plus, Copy, Trash2, LayoutGrid, ArrowRight, ArrowDown } from 'lucide-react';

export const PagesSidebar = () => {
  const {
    project,
    activeCanvasId,
    setActiveCanvas,
    addCanvas,
    removeCanvas,
    duplicateCanvas,
    setPaperSize,
    setLayout,
  } = useEditorStore();

  if (!project) return null;

  const sortedCanvases = [...project.canvases].sort((a, b) => a.order - b.order);

  return (
    <div className="w-56 bg-[#1a1a1a] border-r border-[#333] flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-[#333]">
        <h3 className="text-white text-sm font-semibold mb-3">Pages</h3>
        
        {/* Paper Size */}
        <div className="space-y-2 mb-3">
          <label className="text-[#666] text-xs">Paper Size</label>
          <select
            value={project.paperSize}
            onChange={(e) => setPaperSize(e.target.value as PaperSize)}
            className="w-full bg-[#252525] text-white text-xs px-2 py-1.5 rounded border border-[#333] focus:border-[#3b82f6] outline-none"
          >
            {Object.entries(PAPER_SIZES).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Layout */}
        <div className="space-y-2">
          <label className="text-[#666] text-xs">Layout</label>
          <div className="flex gap-1">
            {([
              { id: 'horizontal', icon: ArrowRight, label: 'Horizontal' },
              { id: 'vertical', icon: ArrowDown, label: 'Vertical' },
              { id: 'grid', icon: LayoutGrid, label: 'Grid' },
            ] as const).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setLayout(id)}
                title={label}
                className={`flex-1 p-1.5 rounded transition-colors ${
                  project.layout === id
                    ? 'bg-[#3b82f6] text-white'
                    : 'bg-[#252525] text-[#888] hover:text-white'
                }`}
              >
                <Icon size={14} className="mx-auto" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pages List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sortedCanvases.map((canvas, index) => (
          <div
            key={canvas.id}
            onClick={() => setActiveCanvas(canvas.id)}
            className={`group relative p-2 rounded-lg cursor-pointer transition-colors ${
              activeCanvasId === canvas.id
                ? 'bg-[#3b82f6]/20 ring-1 ring-[#3b82f6]'
                : 'hover:bg-[#252525]'
            }`}
          >
            {/* Thumbnail */}
            <div
              className="w-full aspect-[3/4] bg-[#252525] rounded border border-[#333] mb-2 overflow-hidden"
              style={{ backgroundColor: canvas.backgroundColor }}
            >
              {/* Mini preview of elements */}
              <div className="w-full h-full relative" style={{ transform: 'scale(0.1)', transformOrigin: 'top left' }}>
                {canvas.elements.slice(0, 5).map((el) => (
                  <div
                    key={el.id}
                    className="absolute bg-[#666]"
                    style={{
                      left: el.x * 0.1,
                      top: el.y * 0.1,
                      width: el.width * 0.1,
                      height: el.height * 0.1,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Name */}
            <span className="text-white text-xs font-medium">
              Page {index + 1}
            </span>

            {/* Actions */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateCanvas(canvas.id);
                }}
                title="Duplicate"
                className="p-1 bg-[#333] rounded hover:bg-[#444] transition-colors"
              >
                <Copy size={12} className="text-[#888]" />
              </button>
              {project.canvases.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeCanvas(canvas.id);
                  }}
                  title="Delete"
                  className="p-1 bg-[#333] rounded hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={12} className="text-[#888] hover:text-red-400" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Page Button */}
      <div className="p-2 border-t border-[#333]">
        <button
          onClick={addCanvas}
          className="w-full flex items-center justify-center gap-2 py-2 bg-[#252525] hover:bg-[#333] text-[#888] hover:text-white rounded-lg transition-colors text-sm"
        >
          <Plus size={16} />
          Add Page
        </button>
      </div>
    </div>
  );
};

