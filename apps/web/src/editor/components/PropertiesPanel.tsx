import { useEditorStore } from '../store';
import { ImageElement, NarrativeElement, DialogueElement, CanvasElement, CLIP_PRESETS, ClipPreset } from '../types';
import {
  Image,
  RotateCcw,
  Layers,
  ArrowUp,
  ArrowDown,
  Trash2,
  Copy,
} from 'lucide-react';
import { TemplatesPanel } from './TemplatesPanel';
import { PolygonEditor } from './PolygonEditor';

export const PropertiesPanel = () => {
  const {
    project,
    selectedIds,
    updateElement,
    deleteSelected,
    duplicateSelected,
    bringToFront,
    sendToBack,
    getActiveCanvas,
    updateCanvas,
    activeCanvasId,
  } = useEditorStore();

  const activeCanvas = getActiveCanvas();
  const selectedElements = activeCanvas?.elements.filter((el) => selectedIds.includes(el.id)) || [];

  // No selection - show canvas settings
  if (selectedElements.length === 0) {
    return (
      <div className="w-80 bg-[#1a1a1a] border-l border-[#333] overflow-y-auto">
        <div className="p-4 space-y-5">
          <h3 className="text-white font-semibold">
            {activeCanvas ? `Page ${(project?.canvases.findIndex(c => c.id === activeCanvas.id) ?? 0) + 1}` : 'Canvas Settings'}
          </h3>

          {activeCanvas && activeCanvasId && (
            <>
              <div className="space-y-2">
                <label className="text-[#888] text-sm">Background Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={activeCanvas.backgroundColor}
                    onChange={(e) => updateCanvas(activeCanvasId, { backgroundColor: e.target.value })}
                    className="w-12 h-8 rounded border border-[#333] cursor-pointer"
                  />
                  <input
                    type="text"
                    value={activeCanvas.backgroundColor}
                    onChange={(e) => updateCanvas(activeCanvasId, { backgroundColor: e.target.value })}
                    className="flex-1 bg-[#252525] text-white text-sm px-3 py-1 rounded border border-[#333] focus:border-[#3b82f6] outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[#888] text-sm">Page Size</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[#555] text-xs">Width</label>
                    <input
                      type="number"
                      value={activeCanvas.width}
                      onChange={(e) => updateCanvas(activeCanvasId, { width: Number(e.target.value) })}
                      className="w-full bg-[#252525] text-white text-sm px-2 py-1 rounded border border-[#333] focus:border-[#3b82f6] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[#555] text-xs">Height</label>
                    <input
                      type="number"
                      value={activeCanvas.height}
                      onChange={(e) => updateCanvas(activeCanvasId, { height: Number(e.target.value) })}
                      className="w-full bg-[#252525] text-white text-sm px-2 py-1 rounded border border-[#333] focus:border-[#3b82f6] outline-none"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="border-t border-[#333] pt-4">
            <TemplatesPanel />
          </div>

          {/* Elements list */}
          {activeCanvas && activeCanvas.elements.length > 0 && (
            <div className="space-y-2">
              <label className="text-[#888] text-sm flex items-center gap-2">
                <Layers size={14} /> Elements ({activeCanvas.elements.length})
              </label>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {[...activeCanvas.elements]
                  .sort((a, b) => b.zIndex - a.zIndex)
                  .map((el) => (
                    <button
                      key={el.id}
                      onClick={() => useEditorStore.getState().select(el.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-[#252525] hover:bg-[#333] rounded-lg text-left transition-colors"
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          el.type === 'image'
                            ? 'bg-purple-500'
                            : el.type === 'narrative'
                            ? 'bg-yellow-500'
                            : 'bg-blue-500'
                        }`}
                      />
                      <span className="flex-1 text-sm text-white truncate capitalize">
                        {el.type}
                      </span>
                      <span className="text-[#555] text-xs">z:{el.zIndex}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Multiple selection
  if (selectedElements.length > 1) {
    return (
      <div className="w-80 bg-[#1a1a1a] border-l border-[#333] overflow-y-auto">
        <div className="p-4 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">{selectedElements.length} Elements</h3>
            <div className="flex gap-1">
              <button
                onClick={duplicateSelected}
                className="p-1.5 text-[#888] hover:text-white hover:bg-[#333] rounded transition-colors"
              >
                <Copy size={16} />
              </button>
              <button
                onClick={deleteSelected}
                className="p-1.5 text-[#888] hover:text-red-400 hover:bg-[#333] rounded transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <p className="text-[#555] text-sm">Multiple elements selected. Select a single element to edit properties.</p>
        </div>
      </div>
    );
  }

  // Single selection
  const element = selectedElements[0];
  const update = (updates: Partial<CanvasElement>) => updateElement(element.id, updates);

  return (
    <div className="w-80 bg-[#1a1a1a] border-l border-[#333] overflow-y-auto">
      <div className="p-4 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold capitalize">{element.type}</h3>
          <div className="flex gap-1">
            <button
              onClick={() => duplicateSelected()}
              title="Duplicate"
              className="p-1.5 text-[#888] hover:text-white hover:bg-[#333] rounded transition-colors"
            >
              <Copy size={16} />
            </button>
            <button
              onClick={() => bringToFront(element.id)}
              title="Bring to Front"
              className="p-1.5 text-[#888] hover:text-white hover:bg-[#333] rounded transition-colors"
            >
              <ArrowUp size={16} />
            </button>
            <button
              onClick={() => sendToBack(element.id)}
              title="Send to Back"
              className="p-1.5 text-[#888] hover:text-white hover:bg-[#333] rounded transition-colors"
            >
              <ArrowDown size={16} />
            </button>
            <button
              onClick={deleteSelected}
              title="Delete"
              className="p-1.5 text-[#888] hover:text-red-400 hover:bg-[#333] rounded transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Type-specific properties */}
        {element.type === 'image' && <ImageProperties element={element} update={update} />}
        {element.type === 'narrative' && <NarrativeProperties element={element} update={update} />}
        {element.type === 'dialogue' && <DialogueProperties element={element} update={update} />}

        <div className="border-t border-[#333] pt-4" />

        {/* Common: Transform */}
        <div className="space-y-3">
          <label className="text-[#888] text-sm">Transform</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#555] text-xs">X</label>
              <input
                type="number"
                value={Math.round(element.x)}
                onChange={(e) => update({ x: Number(e.target.value) })}
                className="w-full bg-[#252525] text-white text-sm px-2 py-1 rounded border border-[#333] focus:border-[#3b82f6] outline-none"
              />
            </div>
            <div>
              <label className="text-[#555] text-xs">Y</label>
              <input
                type="number"
                value={Math.round(element.y)}
                onChange={(e) => update({ y: Number(e.target.value) })}
                className="w-full bg-[#252525] text-white text-sm px-2 py-1 rounded border border-[#333] focus:border-[#3b82f6] outline-none"
              />
            </div>
            <div>
              <label className="text-[#555] text-xs">Width</label>
              <input
                type="number"
                value={Math.round(element.width)}
                onChange={(e) => update({ width: Number(e.target.value) })}
                className="w-full bg-[#252525] text-white text-sm px-2 py-1 rounded border border-[#333] focus:border-[#3b82f6] outline-none"
              />
            </div>
            <div>
              <label className="text-[#555] text-xs">Height</label>
              <input
                type="number"
                value={Math.round(element.height)}
                onChange={(e) => update({ height: Number(e.target.value) })}
                className="w-full bg-[#252525] text-white text-sm px-2 py-1 rounded border border-[#333] focus:border-[#3b82f6] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Rotation (use handle on canvas to rotate) */}
        <div className="flex items-center justify-between">
          <label className="text-[#888] text-sm flex items-center gap-2">
            <RotateCcw size={14} /> Rotation
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={Math.round(element.rotation)}
              onChange={(e) => update({ rotation: Number(e.target.value) })}
              className="w-16 bg-[#252525] text-white text-sm px-2 py-1 rounded border border-[#333] focus:border-[#3b82f6] outline-none text-right"
            />
            <span className="text-[#555] text-xs">°</span>
          </div>
        </div>

        {/* Z-Index */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[#888] text-sm flex items-center gap-2">
              <Layers size={14} /> Layer
            </label>
            <span className="text-[#555] text-xs">z: {element.zIndex}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// IMAGE PROPERTIES
const ImageProperties = ({
  element,
  update,
}: {
  element: ImageElement;
  update: (u: Partial<ImageElement>) => void;
}) => (
  <>
    <div className="space-y-2">
      <label className="text-[#888] text-sm flex items-center gap-2">
        <Image size={14} /> Image URL
      </label>
      <input
        type="text"
        value={element.imageUrl}
        onChange={(e) => update({ imageUrl: e.target.value })}
        placeholder="https://..."
        className="w-full bg-[#252525] text-white text-sm px-3 py-2 rounded-lg border border-[#333] focus:border-[#3b82f6] outline-none"
      />
    </div>

    <div className="space-y-2">
      <label className="text-[#888] text-sm">Border</label>
      <div className="flex gap-2">
        <input
          type="color"
          value={element.borderColor}
          onChange={(e) => update({ borderColor: e.target.value })}
          className="w-10 h-8 rounded border border-[#333] cursor-pointer"
        />
        <input
          type="number"
          value={element.borderWidth}
          onChange={(e) => update({ borderWidth: Number(e.target.value) })}
          min={0}
          max={20}
          className="w-20 bg-[#252525] text-white text-sm px-2 py-1 rounded border border-[#333] focus:border-[#3b82f6] outline-none"
        />
        <span className="text-[#555] text-xs self-center">px</span>
      </div>
    </div>

    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-[#888] text-sm">Sepia</span>
        <span className="text-[#555] text-xs">{Math.round(element.sepiaLevel * 100)}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={element.sepiaLevel}
        onChange={(e) => update({ sepiaLevel: Number(e.target.value) })}
        className="w-full accent-[#3b82f6]"
      />
    </div>

    <div className="space-y-2">
      <span className="text-[#888] text-sm">Shape</span>
      <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-1">
        {(Object.entries(CLIP_PRESETS) as [ClipPreset, typeof CLIP_PRESETS[ClipPreset]][]).map(([key, preset]) => {
          const points = preset.points as unknown as number[][];
          const svgPoints = points.map(([x, y]) => `${x * 0.4},${y * 0.4}`).join(' ');
          return (
            <button
              key={key}
              onClick={() => update({ clipPreset: key, customClipPath: null })}
              title={preset.name}
              className={`aspect-[3/4] p-1 rounded transition-colors ${
                element.clipPreset === key && !element.customClipPath
                  ? 'bg-[#3b82f6]/30 ring-1 ring-[#3b82f6]'
                  : 'bg-[#252525] hover:bg-[#333]'
              }`}
            >
              <svg viewBox="0 0 40 53" className="w-full h-full">
                <polygon
                  points={svgPoints}
                  fill="#666"
                  stroke="#888"
                  strokeWidth="0.5"
                />
              </svg>
            </button>
          );
        })}
      </div>
    </div>

    {/* Polygon Editor - shows when editing custom shape */}
    <PolygonEditor
      points={element.customClipPath || (CLIP_PRESETS[element.clipPreset].points as unknown as number[][])}
      onChange={(points) => update({ customClipPath: points })}
      onReset={() => update({ customClipPath: null })}
    />

    <div className="flex items-center justify-between">
      <span className="text-[#888] text-sm">Comic Overlay</span>
      <button
        onClick={() => update({ showOverlay: !element.showOverlay })}
        className={`w-12 h-6 rounded-full transition-colors ${
          element.showOverlay ? 'bg-[#3b82f6]' : 'bg-[#333]'
        }`}
      >
        <div
          className={`w-5 h-5 bg-white rounded-full transition-transform ${
            element.showOverlay ? 'translate-x-6' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  </>
);

// NARRATIVE PROPERTIES
const NarrativeProperties = ({
  element,
  update,
}: {
  element: NarrativeElement;
  update: (u: Partial<NarrativeElement>) => void;
}) => (
  <>
    <div className="space-y-2">
      <label className="text-[#888] text-sm">Text</label>
      <textarea
        value={element.text}
        onChange={(e) => update({ text: e.target.value })}
        rows={3}
        className="w-full bg-[#252525] text-white text-sm px-3 py-2 rounded-lg border border-[#333] focus:border-[#3b82f6] outline-none resize-none"
      />
    </div>

    <div className="space-y-2">
      <label className="text-[#888] text-sm">Colors</label>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[#555] text-xs">Background</label>
          <input
            type="color"
            value={element.bgColor}
            onChange={(e) => update({ bgColor: e.target.value })}
            className="w-full h-8 rounded border border-[#333] cursor-pointer"
          />
        </div>
        <div>
          <label className="text-[#555] text-xs">Text</label>
          <input
            type="color"
            value={element.textColor}
            onChange={(e) => update({ textColor: e.target.value })}
            className="w-full h-8 rounded border border-[#333] cursor-pointer"
          />
        </div>
        <div>
          <label className="text-[#555] text-xs">Border</label>
          <input
            type="color"
            value={element.borderColor}
            onChange={(e) => update({ borderColor: e.target.value })}
            className="w-full h-8 rounded border border-[#333] cursor-pointer"
          />
        </div>
      </div>
    </div>

    <div className="space-y-2">
      <label className="text-[#888] text-sm">Font</label>
      <div className="flex gap-2">
        {(['comic', 'serif', 'sans'] as const).map((f) => (
          <button
            key={f}
            onClick={() => update({ fontFamily: f })}
            className={`flex-1 py-2 text-xs capitalize rounded border-2 transition-colors ${
              element.fontFamily === f
                ? 'border-[#3b82f6] bg-[#3b82f6]/20 text-white'
                : 'border-[#333] text-[#888] hover:border-[#555]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
    </div>

    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-[#888] text-sm">Font Size</span>
        <span className="text-[#555] text-xs">{element.fontSize}px</span>
      </div>
      <input
        type="range"
        min="10"
        max="32"
        value={element.fontSize}
        onChange={(e) => update({ fontSize: Number(e.target.value) })}
        className="w-full accent-[#3b82f6]"
      />
    </div>

    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-[#888] text-sm">Padding</span>
        <span className="text-[#555] text-xs">{element.padding}px</span>
      </div>
      <input
        type="range"
        min="4"
        max="32"
        value={element.padding}
        onChange={(e) => update({ padding: Number(e.target.value) })}
        className="w-full accent-[#3b82f6]"
      />
    </div>

    {/* Quick presets */}
    <div className="space-y-2">
      <label className="text-[#888] text-sm">Quick Presets</label>
      <div className="grid grid-cols-4 gap-2">
        {[
          { bg: '#fff133', text: '#000', border: '#000' },
          { bg: '#ffffff', text: '#000', border: '#000' },
          { bg: '#000000', text: '#fff', border: '#fff' },
          { bg: '#ff3333', text: '#fff', border: '#000' },
        ].map((p, i) => (
          <button
            key={i}
            onClick={() => update({ bgColor: p.bg, textColor: p.text, borderColor: p.border })}
            className="h-8 rounded border-2 border-[#333] hover:border-[#555] transition-colors"
            style={{ backgroundColor: p.bg }}
          />
        ))}
      </div>
    </div>
  </>
);

// DIALOGUE PROPERTIES
const DialogueProperties = ({
  element,
  update,
}: {
  element: DialogueElement;
  update: (u: Partial<DialogueElement>) => void;
}) => (
  <>
    <div className="space-y-2">
      <label className="text-[#888] text-sm">Speaker</label>
      <input
        type="text"
        value={element.speaker}
        onChange={(e) => update({ speaker: e.target.value })}
        placeholder="CHARACTER"
        className="w-full bg-[#252525] text-white text-sm px-3 py-2 rounded-lg border border-[#333] focus:border-[#3b82f6] outline-none uppercase"
      />
    </div>

    <div className="space-y-2">
      <label className="text-[#888] text-sm">Text</label>
      <textarea
        value={element.text}
        onChange={(e) => update({ text: e.target.value })}
        rows={3}
        className="w-full bg-[#252525] text-white text-sm px-3 py-2 rounded-lg border border-[#333] focus:border-[#3b82f6] outline-none resize-none"
      />
    </div>

    <div className="space-y-2">
      <label className="text-[#888] text-sm">Bubble Style</label>
      <div className="grid grid-cols-4 gap-2">
        {(['round', 'cloud', 'square', 'shout'] as const).map((s) => (
          <button
            key={s}
            onClick={() => update({ bubbleStyle: s })}
            className={`py-2 text-xs capitalize rounded border-2 transition-colors ${
              element.bubbleStyle === s
                ? 'border-[#3b82f6] bg-[#3b82f6]/20 text-white'
                : 'border-[#333] text-[#888] hover:border-[#555]'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>

    <div className="space-y-2">
      <label className="text-[#888] text-sm">Tail Position</label>
      <div className="grid grid-cols-3 gap-2">
        {(['bottom-left', 'bottom-right', 'none'] as const).map((t) => (
          <button
            key={t}
            onClick={() => update({ tailPosition: t })}
            className={`py-2 text-xs capitalize rounded border-2 transition-colors ${
              element.tailPosition === t
                ? 'border-[#3b82f6] bg-[#3b82f6]/20 text-white'
                : 'border-[#333] text-[#888] hover:border-[#555]'
            }`}
          >
            {t === 'bottom-left' ? 'Left' : t === 'bottom-right' ? 'Right' : 'None'}
          </button>
        ))}
      </div>
    </div>

    <div className="space-y-2">
      <label className="text-[#888] text-sm">Colors</label>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[#555] text-xs">Background</label>
          <input
            type="color"
            value={element.bgColor}
            onChange={(e) => update({ bgColor: e.target.value })}
            className="w-full h-8 rounded border border-[#333] cursor-pointer"
          />
        </div>
        <div>
          <label className="text-[#555] text-xs">Text</label>
          <input
            type="color"
            value={element.textColor}
            onChange={(e) => update({ textColor: e.target.value })}
            className="w-full h-8 rounded border border-[#333] cursor-pointer"
          />
        </div>
        <div>
          <label className="text-[#555] text-xs">Border</label>
          <input
            type="color"
            value={element.borderColor}
            onChange={(e) => update({ borderColor: e.target.value })}
            className="w-full h-8 rounded border border-[#333] cursor-pointer"
          />
        </div>
      </div>
    </div>

    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-[#888] text-sm">Font Size</span>
        <span className="text-[#555] text-xs">{element.fontSize}px</span>
      </div>
      <input
        type="range"
        min="10"
        max="32"
        value={element.fontSize}
        onChange={(e) => update({ fontSize: Number(e.target.value) })}
        className="w-full accent-[#3b82f6]"
      />
    </div>

    {/* Quick presets */}
    <div className="space-y-2">
      <label className="text-[#888] text-sm">Quick Presets</label>
      <div className="grid grid-cols-4 gap-2">
        {[
          { bg: '#ffffff', text: '#000', border: '#000' },
          { bg: '#E0F7FA', text: '#000', border: '#000' },
          { bg: '#ffcccc', text: '#000', border: '#000' },
          { bg: '#000000', text: '#fff', border: '#fff' },
        ].map((p, i) => (
          <button
            key={i}
            onClick={() => update({ bgColor: p.bg, textColor: p.text, borderColor: p.border })}
            className="h-8 rounded border-2 border-[#333] hover:border-[#555] transition-colors"
            style={{ backgroundColor: p.bg }}
          />
        ))}
      </div>
    </div>
  </>
);

