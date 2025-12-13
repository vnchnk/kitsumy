import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useEditorStore } from '../store';
import { CanvasElement, ImageElement, NarrativeElement, DialogueElement } from '../types';

const CLIP_VARIANTS = [
  'none',
  'polygon(0% 1%, 99% 0%, 100% 99%, 1% 100%)',
  'polygon(1% 0%, 100% 1%, 99% 100%, 0% 99%)',
  'polygon(2% 2%, 98% 0%, 100% 98%, 0% 100%)',
];

const FONT_FAMILIES = {
  comic: "'Comic Neue', cursive",
  serif: 'Georgia, serif',
  sans: 'system-ui, sans-serif',
};

interface DragState {
  type: 'move' | 'resize' | 'rotate';
  elementId: string;
  startX: number;
  startY: number;
  startElX: number;
  startElY: number;
  startElW: number;
  startElH: number;
  startRotation?: number;
  centerX?: number;
  centerY?: number;
  corner?: 'se' | 'sw' | 'ne' | 'nw';
  // For multi-element move
  startPositions?: Map<string, { x: number; y: number }>;
}

export const EditorCanvas = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasTransformRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef({ x: 0, y: 0 });
  const mouseStartRef = useRef({ x: 0, y: 0 });
  const didPanRef = useRef(false);
  const rafRef = useRef<number>(0);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);

  const {
    project,
    selectedIds,
    select,
    clearSelection,
    updateElement,
    addElement,
    tool,
    zoom,
    panOffset,
    setPanOffset,
    commitToHistory,
    getActiveCanvas,
    activeCanvasId,
    setActiveCanvas,
  } = useEditorStore();

  const activeCanvas = getActiveCanvas();

  // Assign canvas ref for active canvas
  const setCanvasRef = useCallback((el: HTMLDivElement | null) => {
    (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  }, []);

  // Handle wheel/gesture events for pan and zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isGesturing = false;
    
    const handleWheel = (e: WheelEvent) => {
      if (isGesturing) {
        e.preventDefault();
        return;
      }
      
      e.preventDefault();
      
      const transformEl = canvasTransformRef.current;
      if (!transformEl) return;

      const { zoom, panOffset, setZoom, setPanOffset } = useEditorStore.getState();

      // Cmd+scroll = zoom
      if (e.metaKey || e.ctrlKey) {
        const delta = -e.deltaY * 0.01;
        const newZoom = Math.max(0.1, Math.min(3, zoom + delta));

        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const scaleChange = newZoom / zoom;
        const newPanX = mouseX - (mouseX - panOffset.x) * scaleChange;
        const newPanY = mouseY - (mouseY - panOffset.y) * scaleChange;

        setPanOffset({ x: newPanX, y: newPanY });
        setZoom(newZoom);
        transformEl.style.transform = `translate(${newPanX}px, ${newPanY}px) scale(${newZoom})`;
      } else {
        // Regular scroll = pan
        const newPanX = panOffset.x - e.deltaX;
        const newPanY = panOffset.y - e.deltaY;
        
        setPanOffset({ x: newPanX, y: newPanY });
        transformEl.style.transform = `translate(${newPanX}px, ${newPanY}px) scale(${zoom})`;
      }
    };

    // Safari pinch gesture events
    let startZoom = 1;
    let startPan = { x: 0, y: 0 };
    
    const handleGestureStart = (e: any) => {
      e.preventDefault();
      e.stopPropagation();
      isGesturing = true;
      const state = useEditorStore.getState();
      startZoom = state.zoom;
      startPan = { ...state.panOffset };
    };
    
    const handleGestureChange = (e: any) => {
      e.preventDefault();
      e.stopPropagation();
      
      const transformEl = canvasTransformRef.current;
      if (!transformEl) return;

      const { zoom, setZoom, setPanOffset } = useEditorStore.getState();
      
      const newZoom = Math.max(0.1, Math.min(3, startZoom * e.scale));

      const rect = container.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const scaleChange = newZoom / startZoom;
      const newPanX = centerX - (centerX - startPan.x) * scaleChange;
      const newPanY = centerY - (centerY - startPan.y) * scaleChange;

      setPanOffset({ x: newPanX, y: newPanY });
      setZoom(newZoom);
      transformEl.style.transform = `translate(${newPanX}px, ${newPanY}px) scale(${newZoom})`;
    };
    
    const handleGestureEnd = (e: any) => {
      e.preventDefault();
      e.stopPropagation();
      isGesturing = false;
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('gesturestart', handleGestureStart as EventListener);
    container.addEventListener('gesturechange', handleGestureChange as EventListener);
    container.addEventListener('gestureend', handleGestureEnd as EventListener);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('gesturestart', handleGestureStart as EventListener);
      container.removeEventListener('gesturechange', handleGestureChange as EventListener);
      container.removeEventListener('gestureend', handleGestureEnd as EventListener);
    };
  }, [project]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const store = useEditorStore.getState();
      
      if (e.key === 'v') store.setTool('select');
      if (e.key === 'i') store.setTool('add-image');
      if (e.key === 'n') store.setTool('add-narrative');
      if (e.key === 'd') store.setTool('add-dialogue');
      if (e.key === ' ') {
        e.preventDefault();
        store.setTool('pan');
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && store.selectedIds.length > 0) {
        store.deleteSelected();
      }
      if (e.key === 'Escape') {
        store.clearSelection();
        store.setTool('select');
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        store.undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        store.redo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        store.redo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        store.selectAll();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        store.duplicateSelected();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        useEditorStore.getState().setTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      // Don't trigger click actions if we were dragging (pan or selection box)
      if (didPanRef.current) {
        didPanRef.current = false;
        return;
      }

      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;

        if (tool === 'add-image') {
          addElement('image', x - 200, y - 250);
        } else if (tool === 'add-narrative') {
          addElement('narrative', x - 140, y - 40);
        } else if (tool === 'add-dialogue') {
          addElement('dialogue', x - 100, y - 50);
        } else if ((tool === 'select' || tool === 'pan') && !e.shiftKey) {
          clearSelection();
        }
      }
    },
    [tool, zoom, addElement, clearSelection]
  );

  const handleElementMouseDown = (
    e: React.MouseEvent,
    element: CanvasElement,
    type: 'move' | 'resize' | 'rotate',
    corner?: DragState['corner']
  ) => {
    e.stopPropagation();
    if (tool !== 'select') return;

    const isAlreadySelected = selectedIds.includes(element.id);
    
    // If clicking on already selected element - don't change selection (allows multi-drag)
    // If shift/alt - toggle selection
    // If clicking on unselected element - select only it
    if (e.shiftKey || e.altKey) {
      select(element.id, true); // Add/remove from selection
    } else if (!isAlreadySelected) {
      select(element.id, false); // Select only this one
    }
    // If already selected without modifier - keep current selection for multi-drag
    
    if (type === 'rotate') {
      // Calculate center of element for rotation
      const centerX = element.x + element.width / 2;
      const centerY = element.y + element.height / 2;
      setDrag({
        type: 'rotate',
        elementId: element.id,
        startX: e.clientX,
        startY: e.clientY,
        startElX: element.x,
        startElY: element.y,
        startElW: element.width,
        startElH: element.height,
        startRotation: element.rotation,
        centerX,
        centerY,
      });
    } else {
      // For move, store positions of all selected elements
      let startPositions: Map<string, { x: number; y: number }> | undefined;
      if (type === 'move' && activeCanvas) {
        startPositions = new Map();
        const idsToMove = selectedIds.includes(element.id) ? selectedIds : [element.id];
        idsToMove.forEach((id) => {
          const el = activeCanvas.elements.find((e) => e.id === id);
          if (el) {
            startPositions!.set(id, { x: el.x, y: el.y });
          }
        });
      }
      
      setDrag({
        type,
        elementId: element.id,
        startX: e.clientX,
        startY: e.clientY,
        startElX: element.x,
        startElY: element.y,
        startElW: element.width,
        startElH: element.height,
        corner,
        startPositions,
      });
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    mouseStartRef.current = { x: e.clientX, y: e.clientY };
    didPanRef.current = false;
    
    // Alt + drag OR pan tool = pan canvas
    if (tool === 'pan' || e.altKey) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    } else if (tool === 'select' && canvasRef.current) {
      // Check if click is within the canvas bounds
      const rect = canvasRef.current.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom) {
        // Default drag = selection box
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;
        setSelectionBox({ startX: x, startY: y, endX: x, endY: y });
      } else {
        // Click outside canvas - start panning instead
        setIsPanning(true);
        panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
      }
    }
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Selection box drag
      if (selectionBox && canvasRef.current) {
        const movedX = Math.abs(e.clientX - mouseStartRef.current.x);
        const movedY = Math.abs(e.clientY - mouseStartRef.current.y);
        if (movedX > 3 || movedY > 3) {
          didPanRef.current = true;
        }
        
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;
        setSelectionBox((prev) => prev ? { ...prev, endX: x, endY: y } : null);
        return;
      }

      if (isPanning && canvasTransformRef.current) {
        // Only mark as panned if we moved more than 3px (to distinguish from click)
        const movedX = Math.abs(e.clientX - mouseStartRef.current.x);
        const movedY = Math.abs(e.clientY - mouseStartRef.current.y);
        if (movedX > 3 || movedY > 3) {
          didPanRef.current = true;
        }
        
        // Direct DOM manipulation for smooth panning (no re-render)
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          const newX = e.clientX - panStartRef.current.x;
          const newY = e.clientY - panStartRef.current.y;
          if (canvasTransformRef.current) {
            canvasTransformRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(${zoom})`;
          }
        });
        return;
      }

      if (!drag) return;

      const dx = (e.clientX - drag.startX) / zoom;
      const dy = (e.clientY - drag.startY) / zoom;

      if (drag.type === 'move' && activeCanvas) {
        // Move all elements that were selected when drag started
        // Clamp to canvas bounds
        const clamp = (id: string, newX: number, newY: number) => {
          const el = activeCanvas.elements.find((e) => e.id === id);
          if (!el) return { x: newX, y: newY };
          return {
            x: Math.max(0, Math.min(activeCanvas.width - el.width, newX)),
            y: Math.max(0, Math.min(activeCanvas.height - el.height, newY)),
          };
        };
        
        if (drag.startPositions) {
          drag.startPositions.forEach((startPos, id) => {
            const clamped = clamp(id, startPos.x + dx, startPos.y + dy);
            updateElement(id, clamped);
          });
        } else {
          const clamped = clamp(drag.elementId, drag.startElX + dx, drag.startElY + dy);
          updateElement(drag.elementId, clamped);
        }
      } else if (drag.type === 'resize' && activeCanvas) {
        let newW = drag.startElW;
        let newH = drag.startElH;
        let newX = drag.startElX;
        let newY = drag.startElY;

        if (drag.corner === 'se') {
          newW = Math.max(50, drag.startElW + dx);
          newH = Math.max(50, drag.startElH + dy);
        } else if (drag.corner === 'sw') {
          newW = Math.max(50, drag.startElW - dx);
          newX = drag.startElX + dx;
          newH = Math.max(50, drag.startElH + dy);
        } else if (drag.corner === 'ne') {
          newW = Math.max(50, drag.startElW + dx);
          newH = Math.max(50, drag.startElH - dy);
          newY = drag.startElY + dy;
        } else if (drag.corner === 'nw') {
          newW = Math.max(50, drag.startElW - dx);
          newX = drag.startElX + dx;
          newH = Math.max(50, drag.startElH - dy);
          newY = drag.startElY + dy;
        }

        // Clamp to canvas bounds
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);
        newW = Math.min(newW, activeCanvas.width - newX);
        newH = Math.min(newH, activeCanvas.height - newY);

        updateElement(drag.elementId, { x: newX, y: newY, width: newW, height: newH });
      } else if (drag.type === 'rotate' && drag.centerX !== undefined && drag.centerY !== undefined) {
        // Calculate angle from center to current mouse position
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        const canvasX = (e.clientX - rect.left) / zoom;
        const canvasY = (e.clientY - rect.top) / zoom;
        
        // Angle from center to mouse
        const angle = Math.atan2(canvasY - drag.centerY, canvasX - drag.centerX) * (180 / Math.PI);
        // Adjust by 90 degrees since handle is at top
        const newRotation = angle + 90;
        
        updateElement(drag.elementId, { rotation: Math.round(newRotation) });
      }
    },
    [drag, zoom, isPanning, selectionBox, updateElement, setPanOffset]
  );

  const handleMouseUp = (e: React.MouseEvent) => {
    // Finalize selection box
    if (selectionBox && activeCanvas) {
      const minX = Math.min(selectionBox.startX, selectionBox.endX);
      const maxX = Math.max(selectionBox.startX, selectionBox.endX);
      const minY = Math.min(selectionBox.startY, selectionBox.endY);
      const maxY = Math.max(selectionBox.startY, selectionBox.endY);
      
      // Only select if box is big enough (not just a click)
      if (maxX - minX > 5 || maxY - minY > 5) {
        const selectedElements = activeCanvas.elements.filter((el) => {
          const elRight = el.x + el.width;
          const elBottom = el.y + el.height;
          return el.x < maxX && elRight > minX && el.y < maxY && elBottom > minY;
        });
        
        if (selectedElements.length > 0) {
          selectedElements.forEach((el, i) => {
            select(el.id, i > 0 || e.shiftKey);
          });
        }
      }
      setSelectionBox(null);
    }
    
    if (isPanning) {
      // Sync state with final position
      const newX = e.clientX - panStartRef.current.x;
      const newY = e.clientY - panStartRef.current.y;
      setPanOffset({ x: newX, y: newY });
    }
    
    // Commit to history after drag operations
    if (drag) {
      commitToHistory();
    }
    
    setDrag(null);
    setIsPanning(false);
  };


  const renderImageElement = (el: ImageElement, isSelected: boolean) => (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        border: `${el.borderWidth}px solid ${el.borderColor}`,
        clipPath: CLIP_VARIANTS[el.clipVariant],
      }}
    >
      {el.imageUrl ? (
        <img
          src={el.imageUrl}
          alt=""
          className="w-full h-full object-cover"
          style={{ filter: `sepia(${el.sepiaLevel}) contrast(1.15) brightness(0.95)` }}
          draggable={false}
        />
      ) : (
        <div className="w-full h-full bg-[#333] flex items-center justify-center text-[#666] text-sm">
          No Image
        </div>
      )}
      {el.showOverlay && (
        <>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/comic-dots.png')] opacity-10 pointer-events-none mix-blend-multiply" />
          <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(0,0,0,0.4)] pointer-events-none" />
        </>
      )}
    </div>
  );

  const renderNarrativeElement = (el: NarrativeElement) => (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        backgroundColor: el.bgColor,
        color: el.textColor,
        border: `${el.borderWidth}px solid ${el.borderColor}`,
        padding: el.padding,
        fontSize: el.fontSize,
        fontFamily: FONT_FAMILIES[el.fontFamily],
        fontWeight: 'bold',
        lineHeight: 1.3,
        boxShadow: '3px 3px 0 rgba(0,0,0,1)',
      }}
    >
      {el.text}
    </div>
  );

  const renderDialogueElement = (el: DialogueElement) => {
    const borderRadius =
      el.bubbleStyle === 'round'
        ? '16px'
        : el.bubbleStyle === 'cloud'
        ? '20px'
        : el.bubbleStyle === 'square'
        ? '4px'
        : '4px';

    return (
      <div className="absolute inset-0 flex flex-col">
        <div
          className="flex-1 overflow-hidden relative"
          style={{
            backgroundColor: el.bgColor,
            color: el.textColor,
            border: `${el.borderWidth}px solid ${el.borderColor}`,
            borderRadius,
            padding: 12,
            fontSize: el.fontSize,
            fontFamily: FONT_FAMILIES.comic,
            fontWeight: 'bold',
            lineHeight: 1.3,
            boxShadow: '3px 3px 0 rgba(0,0,0,1)',
          }}
        >
          {el.speaker && (
            <span className="block text-[10px] uppercase opacity-50 mb-1">{el.speaker}</span>
          )}
          {el.text}
        </div>
        {/* Tail */}
        {el.tailPosition !== 'none' && (
          <svg
            className="absolute"
            width="20"
            height="15"
            style={{
              bottom: el.tailPosition.startsWith('bottom') ? -12 : undefined,
              top: !el.tailPosition.startsWith('bottom') ? -12 : undefined,
              left: el.tailPosition.includes('left') ? '20%' : undefined,
              right: el.tailPosition.includes('right') ? '20%' : undefined,
              transform: el.tailPosition.startsWith('bottom') ? 'none' : 'rotate(180deg)',
            }}
          >
            <path d="M0,0 L10,15 L20,0" fill={el.bgColor} stroke={el.borderColor} strokeWidth={el.borderWidth} />
          </svg>
        )}
      </div>
    );
  };

  const renderElement = (el: CanvasElement) => {
    const isSelected = selectedIds.includes(el.id);

    return (
      <div
        key={el.id}
        className={`absolute cursor-move ${isSelected ? 'ring-2 ring-[#3b82f6]' : ''}`}
        style={{
          left: el.x,
          top: el.y,
          width: el.width,
          height: el.height,
          transform: `rotate(${el.rotation}deg)`,
          zIndex: el.zIndex,
        }}
        onMouseDown={(e) => handleElementMouseDown(e, el, 'move')}
        onClick={(e) => e.stopPropagation()}
      >
        {el.type === 'image' && renderImageElement(el, isSelected)}
        {el.type === 'narrative' && renderNarrativeElement(el)}
        {el.type === 'dialogue' && renderDialogueElement(el)}

        {/* Resize & Rotate handles */}
        {isSelected && (
          <>
            {/* Rotation handle */}
            <div
              className="absolute left-1/2 -translate-x-1/2 -top-8 flex flex-col items-center z-50"
              onMouseDown={(e) => handleElementMouseDown(e, el, 'rotate')}
            >
              <div className="w-4 h-4 rounded-full bg-white border-2 border-[#3b82f6] cursor-grab hover:bg-[#3b82f6] hover:border-white transition-colors" />
              <div className="w-px h-4 bg-[#3b82f6]" />
            </div>
            {/* Corner resize handles */}
            <div
              className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-[#3b82f6] cursor-nw-resize z-50"
              onMouseDown={(e) => handleElementMouseDown(e, el, 'resize', 'nw')}
            />
            <div
              className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-[#3b82f6] cursor-ne-resize z-50"
              onMouseDown={(e) => handleElementMouseDown(e, el, 'resize', 'ne')}
            />
            <div
              className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-[#3b82f6] cursor-sw-resize z-50"
              onMouseDown={(e) => handleElementMouseDown(e, el, 'resize', 'sw')}
            />
            <div
              className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-[#3b82f6] cursor-se-resize z-50"
              onMouseDown={(e) => handleElementMouseDown(e, el, 'resize', 'se')}
            />
          </>
        )}
      </div>
    );
  };

  if (!project || !activeCanvas) return null;

  const sortedElements = useMemo(
    () => [...activeCanvas.elements].sort((a, b) => a.zIndex - b.zIndex),
    [activeCanvas.elements]
  );

  const sortedCanvases = [...project.canvases].sort((a, b) => a.order - b.order);
  
  // Calculate canvas positions based on layout
  const GAP = 40;
  const canvasPositions = useMemo(() => {
    const positions: Map<string, { x: number; y: number }> = new Map();
    let x = 0;
    let y = 0;
    const cols = project.layout === 'grid' ? Math.ceil(Math.sqrt(sortedCanvases.length)) : 1;
    
    sortedCanvases.forEach((canvas, index) => {
      if (project.layout === 'horizontal') {
        positions.set(canvas.id, { x, y: 0 });
        x += canvas.width + GAP;
      } else if (project.layout === 'vertical') {
        positions.set(canvas.id, { x: 0, y });
        y += canvas.height + GAP;
      } else {
        // Grid
        const col = index % cols;
        const row = Math.floor(index / cols);
        positions.set(canvas.id, { 
          x: col * (canvas.width + GAP), 
          y: row * (canvas.height + GAP) 
        });
      }
    });
    return positions;
  }, [sortedCanvases, project.layout]);

  const activeCanvasPos = canvasPositions.get(activeCanvasId!) || { x: 0, y: 0 };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden bg-[#0a0a0a] relative select-none"
      style={{
        cursor: isPanning
          ? 'grabbing'
          : selectionBox
          ? 'crosshair'
          : tool === 'pan'
          ? 'grab'
          : tool === 'select'
          ? 'default'
          : tool.startsWith('add-')
          ? 'crosshair'
          : 'default',
        touchAction: 'none',
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setDrag(null);
        setIsPanning(false);
        setSelectionBox(null);
      }}
      onMouseDown={handleCanvasMouseDown}
    >
      {/* All Canvases Container */}
      <div
        ref={(el) => { (canvasTransformRef as React.MutableRefObject<HTMLDivElement | null>).current = el; }}
        className="absolute will-change-transform"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Render all canvases */}
        {sortedCanvases.map((canvas, index) => {
          const pos = canvasPositions.get(canvas.id) || { x: 0, y: 0 };
          const isActive = canvas.id === activeCanvasId;
          const canvasSortedElements = [...canvas.elements].sort((a, b) => a.zIndex - b.zIndex);

          return (
            <div
              key={canvas.id}
              className="absolute"
              style={{
                left: pos.x,
                top: pos.y,
                width: canvas.width,
                height: canvas.height,
              }}
              onClick={(e) => {
                if (!isActive) {
                  e.stopPropagation();
                  setActiveCanvas(canvas.id);
                }
              }}
            >
              {/* Canvas content */}
              <div
                ref={isActive ? setCanvasRef : undefined}
                className={`absolute inset-0 overflow-hidden ${
                  isActive ? 'ring-2 ring-[#3b82f6]' : ''
                }`}
                style={{
                  backgroundColor: canvas.backgroundColor,
                  boxShadow: isActive 
                    ? '0 25px 50px -12px rgba(59, 130, 246, 0.25)' 
                    : '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
                }}
                onClick={isActive ? handleCanvasClick : undefined}
              >
                {/* Grid (only on active) */}
                {isActive && (
                  <div
                    className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{
                      backgroundImage: `
                        linear-gradient(to right, #555 1px, transparent 1px),
                        linear-gradient(to bottom, #555 1px, transparent 1px)
                      `,
                      backgroundSize: '50px 50px',
                    }}
                  />
                )}

                {/* Elements */}
                {isActive ? (
                  // Active canvas - render with full interaction
                  <>
                    {canvasSortedElements.filter(el => !selectedIds.includes(el.id)).map(renderElement)}
                    {canvasSortedElements.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-[#999] text-center space-y-2">
                          <p className="text-lg font-medium">Empty page</p>
                          <p className="text-sm">
                            <kbd className="px-2 py-1 bg-[#eee] text-[#666] rounded text-xs">I</kbd> Image &nbsp;
                            <kbd className="px-2 py-1 bg-[#eee] text-[#666] rounded text-xs">N</kbd> Narrative &nbsp;
                            <kbd className="px-2 py-1 bg-[#eee] text-[#666] rounded text-xs">D</kbd> Dialogue
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  // Inactive canvas - render preview only
                  canvasSortedElements.map((el) => (
                    <div
                      key={el.id}
                      className="absolute opacity-70 pointer-events-none"
                      style={{
                        left: el.x,
                        top: el.y,
                        width: el.width,
                        height: el.height,
                        transform: `rotate(${el.rotation}deg)`,
                      }}
                    >
                      {el.type === 'image' && (
                        <div
                          className="w-full h-full bg-[#333] flex items-center justify-center"
                          style={{
                            border: `${(el as ImageElement).borderWidth}px solid ${(el as ImageElement).borderColor}`,
                          }}
                        >
                          {(el as ImageElement).imageUrl ? (
                            <img src={(el as ImageElement).imageUrl} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[#555] text-xs">IMG</span>
                          )}
                        </div>
                      )}
                      {el.type === 'narrative' && (
                        <div
                          className="w-full h-full flex items-center justify-center text-xs p-2"
                          style={{
                            backgroundColor: (el as NarrativeElement).bgColor,
                            color: (el as NarrativeElement).textColor,
                            border: `${(el as NarrativeElement).borderWidth}px solid ${(el as NarrativeElement).borderColor}`,
                          }}
                        >
                          {(el as NarrativeElement).text}
                        </div>
                      )}
                      {el.type === 'dialogue' && (
                        <div
                          className="w-full h-full flex items-center justify-center text-xs p-2 rounded-2xl"
                          style={{
                            backgroundColor: (el as DialogueElement).bgColor,
                            color: (el as DialogueElement).textColor,
                            border: `${(el as DialogueElement).borderWidth}px solid ${(el as DialogueElement).borderColor}`,
                          }}
                        >
                          {(el as DialogueElement).text}
                        </div>
                      )}
                    </div>
                  ))
                )}

                {/* Selection box (only on active) */}
                {isActive && selectionBox && (
                  <div
                    className="absolute border-2 border-[#3b82f6] bg-[#3b82f6]/10 pointer-events-none z-[9999]"
                    style={{
                      left: Math.min(selectionBox.startX, selectionBox.endX),
                      top: Math.min(selectionBox.startY, selectionBox.endY),
                      width: Math.abs(selectionBox.endX - selectionBox.startX),
                      height: Math.abs(selectionBox.endY - selectionBox.startY),
                    }}
                  />
                )}
              </div>

              {/* Page label */}
              <div
                className={`absolute -bottom-6 left-0 text-xs ${
                  isActive ? 'text-[#3b82f6]' : 'text-[#555]'
                }`}
              >
                Page {index + 1}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected elements overlay for active canvas (not clipped) */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: activeCanvas.width,
          height: activeCanvas.height,
          transform: `translate(${panOffset.x + activeCanvasPos.x * zoom}px, ${panOffset.y + activeCanvasPos.y * zoom}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <div className="pointer-events-auto">
          {sortedElements.filter(el => selectedIds.includes(el.id)).map(renderElement)}
        </div>
      </div>

    </div>
  );
};
