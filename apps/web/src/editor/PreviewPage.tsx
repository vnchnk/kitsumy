import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useEditorStore } from './store';
import {
  CanvasElement,
  ImageElement,
  NarrativeElement,
  DialogueElement,
  CLIP_PRESETS,
} from './types';
import { SpeechBubble } from './components/SpeechBubble';

// Render a single element (read-only) - positioned relative to its container
const PreviewElement = ({
  element,
  scaleX,
  scaleY,
  offsetY
}: {
  element: CanvasElement;
  scaleX: number;
  scaleY: number;
  offsetY: number;
}) => {
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: element.x * scaleX,
    top: element.y * scaleY + offsetY,
    width: element.width * scaleX,
    height: element.height * scaleY,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.zIndex,
  };

  if (element.type === 'image') {
    const img = element as ImageElement;
    const clipPath = img.customClipPath || CLIP_PRESETS[img.clipPreset]?.points;
    const clipPathString = clipPath
      ? `polygon(${clipPath.map(([x, y]) => `${x}% ${y}%`).join(', ')})`
      : undefined;

    return (
      <div style={baseStyle}>
        <div
          style={{
            width: '100%',
            height: '100%',
            clipPath: clipPathString,
            border: img.borderWidth > 0 ? `${Math.max(1, img.borderWidth * scaleX)}px solid ${img.borderColor}` : undefined,
            overflow: 'hidden',
          }}
        >
          {img.imageUrl ? (
            <img
              src={img.imageUrl}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: img.sepiaLevel > 0 ? `sepia(${img.sepiaLevel})` : undefined,
              }}
              draggable={false}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#2a2a2a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#666',
                fontSize: 14,
              }}
            >
              No image
            </div>
          )}
        </div>
      </div>
    );
  }

  if (element.type === 'narrative') {
    const narr = element as NarrativeElement;
    const fontMap = {
      comic: '"Comic Neue", "Comic Sans MS", cursive',
      serif: 'Georgia, "Times New Roman", serif',
      sans: 'Arial, Helvetica, sans-serif',
    };

    return (
      <div
        style={{
          ...baseStyle,
          backgroundColor: narr.bgColor,
          color: narr.textColor,
          border: `${Math.max(1, narr.borderWidth * scaleX)}px solid ${narr.borderColor}`,
          padding: narr.padding * scaleX,
          fontSize: narr.fontSize * scaleX,
          fontFamily: fontMap[narr.fontFamily],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          lineHeight: 1.3,
          boxShadow: '2px 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        {narr.text}
      </div>
    );
  }

  if (element.type === 'dialogue') {
    const dlg = element as DialogueElement;
    const bubbleStyleMap: Record<string, 'speech' | 'thought' | 'shout'> = {
      round: 'speech',
      square: 'speech',
      cloud: 'thought',
      shout: 'shout',
      whisper: 'speech',
    };

    return (
      <div style={baseStyle}>
        <SpeechBubble
          width={element.width * scaleX}
          height={element.height * scaleY}
          text={dlg.text}
          textColor={dlg.textColor}
          bgColor={dlg.bgColor}
          borderColor={dlg.borderColor}
          borderWidth={Math.max(1, dlg.borderWidth * scaleX)}
          fontSize={dlg.fontSize * scaleX}
          tailPosition={dlg.tailPosition as any}
          style={bubbleStyleMap[dlg.bubbleStyle] || 'speech'}
        />
      </div>
    );
  }

  return null;
};

export const PreviewPage = () => {
  const { id } = useParams<{ id: string }>();
  const { project } = useEditorStore();

  // If no project in store, try to load from localStorage directly
  const [localProject, setLocalProject] = useState<typeof project>(null);

  useEffect(() => {
    if (!project && id) {
      const saved = localStorage.getItem(`kitsumy-project-${id}`);
      if (saved) {
        try {
          setLocalProject(JSON.parse(saved));
        } catch {
          // ignore
        }
      }
    }
  }, [id, project]);

  const displayProject = project || localProject;

  if (!displayProject) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-xl mb-2">No project loaded</p>
          <p className="text-gray-400">Open the editor first and import a comic</p>
          <Link
            to={`/project/${id}/edit`}
            className="mt-4 inline-block px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 transition-colors"
          >
            Go to Editor
          </Link>
        </div>
      </div>
    );
  }

  const sortedCanvases = [...displayProject.canvases].sort((a, b) => a.order - b.order);

  // Calculate total height and scale to fit viewport width
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const targetWidth = Math.min(viewportWidth - 48, 900); // Max 900px width with padding

  // Use first canvas dimensions as reference
  const refCanvas = sortedCanvases[0];
  const scaleX = targetWidth / (refCanvas?.width || 794);
  const scaleY = scaleX; // Keep aspect ratio

  // Calculate cumulative heights for positioning
  let cumulativeHeight = 0;
  const canvasOffsets: number[] = [];

  for (const canvas of sortedCanvases) {
    canvasOffsets.push(cumulativeHeight);
    cumulativeHeight += canvas.height * scaleY;
  }

  // Collect all elements with their offsets
  const allElements: { element: CanvasElement; offsetY: number; canvasWidth: number; canvasHeight: number }[] = [];

  sortedCanvases.forEach((canvas, idx) => {
    const sortedElements = [...canvas.elements].sort((a, b) => a.zIndex - b.zIndex);
    sortedElements.forEach(element => {
      allElements.push({
        element,
        offsetY: canvasOffsets[idx],
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
      });
    });
  });

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bangers&family=Comic+Neue:wght@400;700&display=swap');
      `}</style>

      {/* Floating back button */}
      <Link
        to={`/project/${id}/edit`}
        className="fixed top-4 left-4 z-50 px-4 py-2 bg-black/80 text-white rounded-full hover:bg-black transition-colors flex items-center gap-2 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Editor
      </Link>

      {/* Comic content - full width continuous flow */}
      <div
        className="mx-auto"
        style={{
          width: targetWidth,
          paddingTop: 24,
          paddingBottom: 48,
        }}
      >
        {/* Title */}
        <h1
          className="text-center font-bold mb-6"
          style={{
            fontFamily: '"Bangers", cursive',
            fontSize: 32,
            letterSpacing: 2,
          }}
        >
          {displayProject.title}
        </h1>

        {/* All canvases rendered as one continuous block */}
        <div
          className="relative bg-white"
          style={{
            width: targetWidth,
            height: cumulativeHeight,
          }}
        >
          {allElements.map(({ element, offsetY }) => (
            <PreviewElement
              key={element.id}
              element={element}
              scaleX={scaleX}
              scaleY={scaleY}
              offsetY={offsetY}
            />
          ))}
        </div>

        {/* End mark */}
        <div className="text-center mt-8 text-gray-400 text-sm">
          — THE END —
        </div>
      </div>
    </div>
  );
};
