import { useEditorStore } from '../store';
import { Tool } from '../types';
import {
  MousePointer2,
  ImagePlus,
  Type,
  MessageCircle,
  ZoomIn,
  ZoomOut,
  Download,
  Upload,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Undo2,
  Redo2,
  Eye,
} from 'lucide-react';
import { useRef } from 'react';
import { Link, useParams } from 'react-router-dom';

export const EditorToolbar = () => {
  const { id } = useParams<{ id: string }>();
  const {
    tool,
    setTool,
    zoom,
    setZoom,
    exportJSON,
    importJSON,
    selectedIds,
    deleteSelected,
    duplicateSelected,
    bringToFront,
    sendToBack,
    project,
    setProjectTitle,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useEditorStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const tools: { id: Tool; icon: typeof MousePointer2; label: string; key: string }[] = [
    { id: 'select', icon: MousePointer2, label: 'Select & Pan', key: 'V' },
    { id: 'add-image', icon: ImagePlus, label: 'Add Image', key: 'I' },
    { id: 'add-narrative', icon: Type, label: 'Add Narrative', key: 'N' },
    { id: 'add-dialogue', icon: MessageCircle, label: 'Add Dialogue', key: 'D' },
  ];

  const handleExport = () => {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project?.title || 'comic'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const json = e.target?.result as string;
      importJSON(json);
    };
    reader.readAsText(file);
  };

  return (
    <div className="h-14 bg-[#1a1a1a] border-b border-[#333] flex items-center px-4 gap-2">
      {/* Title */}
      <input
        type="text"
        value={project?.title || ''}
        onChange={(e) => setProjectTitle(e.target.value)}
        className="bg-transparent text-white font-semibold text-lg w-48 outline-none border-b border-transparent hover:border-[#555] focus:border-[#888] transition-colors"
      />

      <div className="w-px h-8 bg-[#333] mx-2" />

      {/* Tools */}
      <div className="flex gap-1 bg-[#252525] rounded-lg p-1">
        {tools.map(({ id, icon: Icon, label, key }) => (
          <button
            key={id}
            onClick={() => setTool(id)}
            title={`${label} (${key})`}
            className={`p-2 rounded-md transition-colors ${
              tool === id
                ? 'bg-[#3b82f6] text-white'
                : 'text-[#888] hover:text-white hover:bg-[#333]'
            }`}
          >
            <Icon size={18} />
          </button>
        ))}
      </div>

      <div className="w-px h-8 bg-[#333] mx-2" />

      {/* Zoom */}
      <div className="flex items-center gap-1 bg-[#252525] rounded-lg p-1">
        <button
          onClick={() => setZoom(zoom - 0.1)}
          className="p-2 rounded-md text-[#888] hover:text-white hover:bg-[#333] transition-colors"
        >
          <ZoomOut size={18} />
        </button>
        <span className="text-[#888] text-sm w-14 text-center font-mono">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(zoom + 0.1)}
          className="p-2 rounded-md text-[#888] hover:text-white hover:bg-[#333] transition-colors"
        >
          <ZoomIn size={18} />
        </button>
      </div>

      <div className="w-px h-8 bg-[#333] mx-2" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-1 bg-[#252525] rounded-lg p-1">
        <button
          onClick={undo}
          disabled={!canUndo()}
          title="Undo (Cmd+Z)"
          className={`p-2 rounded-md transition-colors ${
            canUndo()
              ? 'text-[#888] hover:text-white hover:bg-[#333]'
              : 'text-[#444] cursor-not-allowed'
          }`}
        >
          <Undo2 size={18} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo()}
          title="Redo (Cmd+Shift+Z)"
          className={`p-2 rounded-md transition-colors ${
            canRedo()
              ? 'text-[#888] hover:text-white hover:bg-[#333]'
              : 'text-[#444] cursor-not-allowed'
          }`}
        >
          <Redo2 size={18} />
        </button>
      </div>

      <div className="flex-1" />

      {/* Selection Actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-1 bg-[#252525] rounded-lg p-1 mr-2">
          <span className="px-2 text-[#555] text-xs">
            {selectedIds.length} selected
          </span>
          <button
            onClick={duplicateSelected}
            title="Duplicate (Cmd+D)"
            className="p-2 rounded-md text-[#888] hover:text-white hover:bg-[#333] transition-colors"
          >
            <Copy size={18} />
          </button>
          <button
            onClick={() => selectedIds.length === 1 && bringToFront(selectedIds[0])}
            title="Bring to Front"
            className="p-2 rounded-md text-[#888] hover:text-white hover:bg-[#333] transition-colors"
            disabled={selectedIds.length !== 1}
          >
            <ArrowUp size={18} />
          </button>
          <button
            onClick={() => selectedIds.length === 1 && sendToBack(selectedIds[0])}
            title="Send to Back"
            className="p-2 rounded-md text-[#888] hover:text-white hover:bg-[#333] transition-colors"
            disabled={selectedIds.length !== 1}
          >
            <ArrowDown size={18} />
          </button>
          <button
            onClick={deleteSelected}
            title="Delete"
            className="p-2 rounded-md text-[#888] hover:text-red-400 hover:bg-[#333] transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>
      )}

      {/* Import/Export */}
      <div className="flex gap-1 bg-[#252525] rounded-lg p-1">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Import JSON"
          className="p-2 rounded-md text-[#888] hover:text-white hover:bg-[#333] transition-colors"
        >
          <Upload size={18} />
        </button>
        <button
          onClick={handleExport}
          title="Export JSON"
          className="p-2 rounded-md text-[#888] hover:text-white hover:bg-[#333] transition-colors"
        >
          <Download size={18} />
        </button>
      </div>

      <div className="w-px h-8 bg-[#333] mx-2" />

      {/* Preview */}
      <Link
        to={`/project/${id}/preview`}
        className="flex items-center gap-2 px-3 py-2 bg-[#252525] rounded-lg text-[#888] hover:text-white hover:bg-[#333] transition-colors"
      >
        <Eye size={18} />
        <span className="text-sm">Preview</span>
      </Link>
    </div>
  );
};
