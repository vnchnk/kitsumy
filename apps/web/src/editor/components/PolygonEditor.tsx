import { useState, useRef, useCallback } from 'react';
import { Plus, RotateCcw } from 'lucide-react';

interface Props {
  points: number[][];
  onChange: (points: number[][]) => void;
  onReset: () => void;
}

export const PolygonEditor = ({ points, onChange, onReset }: Props) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const WIDTH = 200;
  const HEIGHT = 267; // 3:4 aspect ratio

  const toSvgCoords = (percentX: number, percentY: number) => ({
    x: (percentX / 100) * WIDTH,
    y: (percentY / 100) * HEIGHT,
  });

  const toPercentCoords = (svgX: number, svgY: number) => ({
    x: Math.round((svgX / WIDTH) * 100),
    y: Math.round((svgY / HEIGHT) * 100),
  });

  const getMousePos = useCallback((e: React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleMouseDown = (index: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingIndex(index);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingIndex === null) return;
    
    const pos = getMousePos(e);
    const percent = toPercentCoords(pos.x, pos.y);
    
    // Clamp to bounds
    const clampedX = Math.max(0, Math.min(100, percent.x));
    const clampedY = Math.max(0, Math.min(100, percent.y));
    
    const newPoints = [...points];
    newPoints[draggingIndex] = [clampedX, clampedY];
    onChange(newPoints);
  }, [draggingIndex, points, onChange, getMousePos]);

  const handleMouseUp = () => {
    setDraggingIndex(null);
  };

  const addPoint = () => {
    if (points.length >= 12) return; // Max 12 points
    
    // Add point in the middle of the longest edge
    let maxDist = 0;
    let insertIndex = 0;
    
    for (let i = 0; i < points.length; i++) {
      const next = (i + 1) % points.length;
      const dx = points[next][0] - points[i][0];
      const dy = points[next][1] - points[i][1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxDist) {
        maxDist = dist;
        insertIndex = next;
      }
    }
    
    const prev = insertIndex === 0 ? points.length - 1 : insertIndex - 1;
    const midX = Math.round((points[prev][0] + points[insertIndex][0]) / 2);
    const midY = Math.round((points[prev][1] + points[insertIndex][1]) / 2);
    
    const newPoints = [...points];
    newPoints.splice(insertIndex, 0, [midX, midY]);
    onChange(newPoints);
  };

  const removePoint = (index: number) => {
    if (points.length <= 3) return; // Min 3 points
    const newPoints = points.filter((_, i) => i !== index);
    onChange(newPoints);
  };

  const svgPoints = points.map(([x, y]) => toSvgCoords(x, y));
  const polygonString = svgPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[#888] text-sm">Custom Shape</span>
        <div className="flex gap-1">
          <button
            onClick={addPoint}
            disabled={points.length >= 12}
            title="Add point"
            className="p-1 text-[#888] hover:text-white hover:bg-[#333] rounded disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={onReset}
            title="Reset to preset"
            className="p-1 text-[#888] hover:text-white hover:bg-[#333] rounded"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>
      
      <div 
        className="bg-[#252525] rounded-lg p-2 border border-[#333]"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          style={{ aspectRatio: '3/4' }}
        >
          {/* Background */}
          <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="#1a1a1a" rx="4" />
          
          {/* Grid */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#333" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="url(#grid)" />
          
          {/* Shape fill */}
          <polygon
            points={polygonString}
            fill="#3b82f6"
            fillOpacity={0.2}
            stroke="#3b82f6"
            strokeWidth="2"
          />
          
          {/* Edge lines with midpoint for adding */}
          {svgPoints.map((point, i) => {
            const next = svgPoints[(i + 1) % svgPoints.length];
            return (
              <line
                key={`edge-${i}`}
                x1={point.x}
                y1={point.y}
                x2={next.x}
                y2={next.y}
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
              />
            );
          })}
          
          {/* Control points */}
          {svgPoints.map((point, i) => (
            <g key={i}>
              {/* Hit area */}
              <circle
                cx={point.x}
                cy={point.y}
                r="12"
                fill="transparent"
                style={{ cursor: 'grab' }}
                onMouseDown={handleMouseDown(i)}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
              {/* Visible point */}
              <circle
                cx={point.x}
                cy={point.y}
                r={draggingIndex === i ? 8 : hoveredIndex === i ? 7 : 5}
                fill={draggingIndex === i ? '#60a5fa' : '#3b82f6'}
                stroke="#fff"
                strokeWidth="2"
                style={{ 
                  cursor: draggingIndex === i ? 'grabbing' : 'grab',
                  transition: 'r 0.1s'
                }}
                onMouseDown={handleMouseDown(i)}
              />
              {/* Delete button on hover */}
              {hoveredIndex === i && points.length > 3 && (
                <g
                  onClick={(e) => {
                    e.stopPropagation();
                    removePoint(i);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    cx={point.x + 12}
                    cy={point.y - 12}
                    r="8"
                    fill="#ef4444"
                  />
                  <text
                    x={point.x + 12}
                    y={point.y - 8}
                    textAnchor="middle"
                    fill="white"
                    fontSize="12"
                    fontWeight="bold"
                  >
                    ×
                  </text>
                </g>
              )}
              {/* Point label */}
              <text
                x={point.x}
                y={point.y - 12}
                textAnchor="middle"
                fill="#666"
                fontSize="10"
              >
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>
      
      <p className="text-[#555] text-xs">
        Drag points to reshape. {points.length}/12 points.
      </p>
    </div>
  );
};


