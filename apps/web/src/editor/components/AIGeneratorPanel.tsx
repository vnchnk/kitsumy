import { useState } from 'react';
import { useEditorStore } from '../store';
import { ImageElement, NarrativeElement, DialogueElement, PAPER_SIZES } from '../types';
import { Sparkles, Loader2 } from 'lucide-react';
import { ComicStyle, COMIC_STYLE_NAMES } from '@kitsumy/types';
import {
  calculateBubbleDimensions,
  constrainBubblePosition,
  distributeBubbles,
} from '../utils/textMeasure';

const STYLES: ComicStyle[] = [
  'american-classic',
  'noir',
  'manga',
  'euro-bd',
  'watercolor',
  'retro',
  'cyberpunk',
  'whimsical',
  'horror',
  'minimalist',
  'ukiyo-e',
  'pop-art',
  'sketch',
  'cel-shaded',
  'pulp',
  'woodcut',
  'art-nouveau',
  'graffiti',
  'chibi',
  'soviet-poster'
];

const createId = () => Math.random().toString(36).slice(2, 11);

interface AIPanel {
  narrative: string;
  dialogue: Array<{ speaker: string; text: string }>;
  visualPrompt: string;
  imageUrl: string;
  chapterTitle: string;
}

interface AIGenerationResponse {
  success: boolean;
  data?: {
    type: 'comic';
    title: string;
    panels: AIPanel[];
  };
  error?: string;
}


export const AIGeneratorPanel = () => {
  const { project, addCanvas, setActiveCanvas, updateCanvas, addElements, setPaperSize } = useEditorStore();

  const [prompt, setPrompt] = useState('');
  const [maxPages, setMaxPages] = useState<number>(1); // Default: 1 page for testing
  const [style, setStyle] = useState<ComicStyle>('american-classic');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');

  const generateFromAI = async () => {
    if (!prompt.trim()) {
      setError('Please enter a topic');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setEstimatedTime('');

    // Initial phases with time estimates
    const SECONDS_PER_IMAGE = 12; // 12 seconds per image due to rate limiting
    const AVERAGE_PANELS = 35; // Typical: 7 chapters × 5 panels
    const ARCHITECTURE_TIME = 30; // seconds
    const SCRIPTWRITING_TIME = 60; // seconds

    setProgress('Architecting the story...');
    setEstimatedTime(`Estimated total time: ${Math.ceil((ARCHITECTURE_TIME + SCRIPTWRITING_TIME + AVERAGE_PANELS * SECONDS_PER_IMAGE) / 60)} minutes`);

    let startTime = Date.now();

    try {
      const requestBody = {
        mode: 'learning',
        prompt: prompt.trim(),
        style: style,
        maxPages: maxPages,
        userContext: {},
      };
      
      const response = await fetch('http://localhost:3001/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Failed to generate comic');
      }

      const result: AIGenerationResponse = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Generation failed');
      }

      const totalPanels = result.data.panels.length;
      const elapsedMinutes = Math.ceil((Date.now() - startTime) / 60000);

      setProgress(`Converting to pages... (Generated ${totalPanels} panels in ${elapsedMinutes} min)`);
      setEstimatedTime('');

      await convertAIPanelsToProject(result.data);

      setProgress('Done!');
      setTimeout(() => {
        setPrompt('');
        setProgress('');
        setEstimatedTime('');
        setIsGenerating(false);
      }, 1000);

    } catch (err) {
      console.error('AI Generation error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsGenerating(false);
      setProgress('');
      setEstimatedTime('');
    }
  };

  const convertAIPanelsToProject = async (data: { title: string; panels: AIPanel[] }) => {
    if (!project) return;

    // Set project title
    const { setProjectTitle } = useEditorStore.getState();
    setProjectTitle(data.title);

    // Set paper size to A4 Portrait
    setPaperSize('A4');

    // Smart grouping: vary panels per page for visual interest
    const pageGroups: AIPanel[][] = [];
    let i = 0;
    while (i < data.panels.length) {
      // Choose panel count based on position and remaining panels
      let panelsInPage: number;
      const remaining = data.panels.length - i;

      if (i === 0) {
        // First page: dramatic single panel or 2 panels
        panelsInPage = remaining >= 2 ? 2 : 1;
      } else if (remaining === 1) {
        // Last panel alone: give it full page
        panelsInPage = 1;
      } else if (remaining <= 3) {
        // Last few panels: group them nicely
        panelsInPage = remaining;
      } else {
        // Vary between 3, 4, or 6 panels for visual diversity
        const options = [3, 4, 6].filter(n => n <= remaining);
        panelsInPage = options[Math.floor(Math.random() * options.length)];
      }

      pageGroups.push(data.panels.slice(i, i + panelsInPage));
      i += panelsInPage;
    }

    const paperSize = PAPER_SIZES['A4'];
    const MARGIN = 30;
    const GAP = 12;
    const availableWidth = paperSize.width - MARGIN * 2;
    const availableHeight = paperSize.height - MARGIN * 2;

    // Layout templates for different panel counts
    const getLayoutForPanels = (count: number) => {
      if (count === 1) {
        // Single dramatic splash page
        return [{ x: 0, y: 0, w: 1, h: 1 }];
      } else if (count === 2) {
        // Two stacked panels
        return [
          { x: 0, y: 0, w: 1, h: 0.48 },
          { x: 0, y: 0.52, w: 1, h: 0.48 },
        ];
      } else if (count === 3) {
        // Classic comic layout: wide top, two bottom
        return [
          { x: 0, y: 0, w: 1, h: 0.45 },
          { x: 0, y: 0.48, w: 0.48, h: 0.52 },
          { x: 0.52, y: 0.48, w: 0.48, h: 0.52 },
        ];
      } else if (count === 4) {
        // 2x2 grid
        return [
          { x: 0, y: 0, w: 0.48, h: 0.48 },
          { x: 0.52, y: 0, w: 0.48, h: 0.48 },
          { x: 0, y: 0.52, w: 0.48, h: 0.48 },
          { x: 0.52, y: 0.52, w: 0.48, h: 0.48 },
        ];
      } else if (count === 6) {
        // 3x2 grid (comic book classic)
        return [
          { x: 0, y: 0, w: 0.48, h: 0.31 },
          { x: 0.52, y: 0, w: 0.48, h: 0.31 },
          { x: 0, y: 0.345, w: 0.48, h: 0.31 },
          { x: 0.52, y: 0.345, w: 0.48, h: 0.31 },
          { x: 0, y: 0.69, w: 0.48, h: 0.31 },
          { x: 0.52, y: 0.69, w: 0.48, h: 0.31 },
        ];
      }
      return [];
    };

    // Create canvases and populate them
    for (let pageIndex = 0; pageIndex < pageGroups.length; pageIndex++) {
      const panelsOnPage = pageGroups[pageIndex];

      // Add new canvas
      addCanvas();

      // Get the newly created canvas
      const canvases = useEditorStore.getState().project?.canvases || [];
      const newCanvas = canvases[canvases.length - 1];
      if (!newCanvas) continue;

      setActiveCanvas(newCanvas.id);

      const layout = getLayoutForPanels(panelsOnPage.length);
      const elements: (ImageElement | NarrativeElement | DialogueElement)[] = [];

      panelsOnPage.forEach((panel, panelIndex) => {
        const layoutSpec = layout[panelIndex];
        if (!layoutSpec) return;

        const baseZIndex = panelIndex * 10;

        // Calculate position and size from layout spec (percentages)
        const panelX = MARGIN + layoutSpec.x * availableWidth;
        const panelY = MARGIN + layoutSpec.y * availableHeight;
        const panelW = layoutSpec.w * availableWidth - (layoutSpec.x > 0 ? GAP / 2 : 0) - (layoutSpec.x + layoutSpec.w < 1 ? GAP / 2 : 0);
        const panelH = layoutSpec.h * availableHeight - (layoutSpec.y > 0 ? GAP / 2 : 0) - (layoutSpec.y + layoutSpec.h < 1 ? GAP / 2 : 0);

        // 1. Create Image Element (takes full panel space)
        const imageElement: ImageElement = {
          id: createId(),
          type: 'image',
          x: Math.round(panelX),
          y: Math.round(panelY),
          width: Math.round(panelW),
          height: Math.round(panelH),
          rotation: 0,
          zIndex: baseZIndex,
          imageUrl: panel.imageUrl,
          borderWidth: 4,
          borderColor: '#000000',
          borderStyle: 'clean',
          sepiaLevel: 0.15,
          clipPreset: 'none',
          customClipPath: null,
          showOverlay: true,
        };
        elements.push(imageElement);

        // 2. Create Narrative Element OVER the image (top-center)
        // Use smart text measurement for proper sizing
        let narrativeHeight = 0;
        if (panel.narrative && panel.narrative.trim()) {
          const narrativeDims = calculateBubbleDimensions({
            text: panel.narrative,
            fontSize: 11,
            fontFamily: 'comic',
            maxWidth: panelW * 0.75,
            maxHeight: panelH * 0.25,
            padding: 10,
            tailHeight: 0, // Narrative boxes don't have tails
            minWidth: 100,
            minHeight: 35,
          });

          const narrativeW = narrativeDims.width;
          narrativeHeight = narrativeDims.height;

          // Constrain position within panel
          const narrativePos = constrainBubblePosition(
            panelX + (panelW - narrativeW) / 2,
            panelY + 10,
            narrativeW,
            narrativeHeight,
            panelX, panelY, panelW, panelH,
            8
          );

          const narrativeElement: NarrativeElement = {
            id: createId(),
            type: 'narrative',
            x: Math.round(narrativePos.x),
            y: Math.round(narrativePos.y),
            width: Math.round(narrativeW),
            height: Math.round(narrativeHeight),
            rotation: -1,
            zIndex: baseZIndex + 5,
            text: panel.narrative,
            bgColor: '#fff9db',
            textColor: '#000000',
            borderColor: '#000000',
            borderWidth: 2,
            fontSize: narrativeDims.fontSize,
            fontFamily: 'comic',
            padding: 10,
          };
          elements.push(narrativeElement);
        }

        // 3. Create Dialogue Bubbles with smart sizing
        const dialogueBubbles: Array<{
          x: number; y: number; width: number; height: number;
          text: string; speaker: string; fontSize: number;
        }> = [];

        panel.dialogue.forEach((dia) => {
          // Calculate optimal bubble size based on text
          const bubbleDims = calculateBubbleDimensions({
            text: dia.text,
            fontSize: 12,
            fontFamily: 'comic',
            maxWidth: panelW * 0.45,  // Max 45% of panel width
            maxHeight: panelH * 0.35, // Max 35% of panel height
            padding: 12,
            tailHeight: 20,
            minWidth: 80,
            minHeight: 50,
          });

          dialogueBubbles.push({
            x: 0, // Will be set by distribution
            y: 0,
            width: bubbleDims.width,
            height: bubbleDims.height,
            text: dia.text,
            speaker: dia.speaker,
            fontSize: bubbleDims.fontSize,
          });
        });

        // Calculate initial positions for bubbles
        const initialPositions = dialogueBubbles.map((bubble, diaIndex) => {
          // Avoid narrative box area (top center)
          const hasNarrative = narrativeHeight > 0;
          const safeTopY = hasNarrative ? panelY + narrativeHeight + 15 : panelY + 10;

          let x, y;
          if (diaIndex === 0) {
            // First bubble: top-left or bottom-left
            x = panelX + 10;
            y = hasNarrative ? panelY + panelH - bubble.height - 10 : safeTopY;
          } else if (diaIndex === 1) {
            // Second bubble: top-right or bottom-right
            x = panelX + panelW - bubble.width - 10;
            y = hasNarrative ? panelY + panelH - bubble.height - 10 : safeTopY;
          } else {
            // Additional bubbles: middle area
            x = panelX + panelW - bubble.width - 10;
            y = panelY + (panelH - bubble.height) / 2;
          }

          return { ...bubble, x, y };
        });

        // Distribute bubbles to avoid overlaps
        const distributedPositions = distributeBubbles(
          initialPositions,
          panelX, panelY, panelW, panelH
        );

        // Create dialogue elements with calculated positions
        dialogueBubbles.forEach((bubble, diaIndex) => {
          const pos = distributedPositions[diaIndex];

          // Determine tail position based on bubble location in panel
          const bubbleCenterX = pos.x + bubble.width / 2;
          const bubbleCenterY = pos.y + bubble.height / 2;
          const panelCenterX = panelX + panelW / 2;
          const panelCenterY = panelY + panelH / 2;

          let tailPosition: 'bottom-left' | 'bottom-center' | 'bottom-right' | 'top-left' | 'top-center' | 'top-right';
          if (bubbleCenterY < panelCenterY) {
            // Bubble is in top half - tail points down
            if (bubbleCenterX < panelCenterX - panelW * 0.15) {
              tailPosition = 'bottom-right';
            } else if (bubbleCenterX > panelCenterX + panelW * 0.15) {
              tailPosition = 'bottom-left';
            } else {
              tailPosition = 'bottom-center';
            }
          } else {
            // Bubble is in bottom half - tail points up
            if (bubbleCenterX < panelCenterX - panelW * 0.15) {
              tailPosition = 'top-right';
            } else if (bubbleCenterX > panelCenterX + panelW * 0.15) {
              tailPosition = 'top-left';
            } else {
              tailPosition = 'top-center';
            }
          }

          const dialogueElement: DialogueElement = {
            id: createId(),
            type: 'dialogue',
            x: Math.round(pos.x),
            y: Math.round(pos.y),
            width: Math.round(bubble.width),
            height: Math.round(bubble.height),
            rotation: 0,
            zIndex: baseZIndex + 10 + diaIndex,
            speaker: bubble.speaker,
            text: bubble.text,
            bgColor: '#ffffff',
            textColor: '#000000',
            borderColor: '#000000',
            borderWidth: 3,
            fontSize: bubble.fontSize,
            tailPosition,
            bubbleStyle: 'round',
          };
          elements.push(dialogueElement);
        });
      });

      // Add all elements to the canvas
      addElements(elements);
    }

    // Switch to first generated page
    const firstNewCanvas = useEditorStore.getState().project?.canvases[1];
    if (firstNewCanvas) {
      setActiveCanvas(firstNewCanvas.id);
    }
  };


  return (
    <div className="space-y-3">
      <label className="text-[#888] text-sm flex items-center gap-2">
        <Sparkles size={14} className="text-[#3b82f6]" />
        AI Comic Generator
      </label>

      <div>
        <label className="text-[#666] text-xs mb-1.5 block">Art Style</label>
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value as ComicStyle)}
          className="w-full bg-[#252525] text-white text-sm px-3 py-2 rounded border border-[#333] focus:border-[#3b82f6] outline-none"
          disabled={isGenerating}
        >
          {STYLES.map((s) => (
            <option key={s} value={s}>{COMIC_STYLE_NAMES[s]}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[#666] text-xs mb-1.5 block">Pages</label>
        <select
          value={maxPages}
          onChange={(e) => setMaxPages(Number(e.target.value))}
          className="w-full bg-[#252525] text-white text-sm px-3 py-2 rounded border border-[#333] focus:border-[#3b82f6] outline-none"
          disabled={isGenerating}
        >
          <option value={1}>1 page (test)</option>
          <option value={3}>3 pages</option>
          <option value={5}>5 pages</option>
          <option value={10}>10 pages</option>
          <option value={20}>20 pages</option>
          <option value={999}>All</option>
        </select>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter a topic... (e.g., 'World War II', 'Photosynthesis', 'The Matrix with cats')"
        className="w-full h-24 bg-[#252525] text-white text-sm px-3 py-2 rounded border border-[#333] focus:border-[#3b82f6] outline-none resize-none"
        disabled={isGenerating}
      />

      {error && (
        <div className="text-red-400 text-xs bg-red-900/20 border border-red-900/50 rounded px-3 py-2">
          {error}
        </div>
      )}

      {progress && (
        <div className="text-[#3b82f6] text-xs bg-blue-900/20 border border-blue-900/50 rounded px-3 py-2">
          <div className="flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" />
            <span>{progress}</span>
          </div>
          {estimatedTime && (
            <div className="text-[#888] mt-1 ml-5">
              {estimatedTime}
            </div>
          )}
        </div>
      )}

      <button
        onClick={generateFromAI}
        disabled={isGenerating || !prompt.trim()}
        className="w-full bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] hover:from-[#2563eb] hover:to-[#7c3aed] disabled:from-[#374151] disabled:to-[#374151] text-white font-medium py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
      >
        {isGenerating ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles size={16} />
            Generate Comic
          </>
        )}
      </button>

      <div className="text-[#666] text-xs leading-relaxed pt-2 border-t border-[#333]">
        <p className="font-medium text-[#888] mb-1">How it works:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>AI creates a narrative arc with 6-10 chapters</li>
          <li>Each chapter gets 3-5 cinematic panels</li>
          <li>Images generated via Flux Schnell ($0.003/image)</li>
          <li>Dynamic layouts: 1-6 panels per page for variety</li>
          <li>Auto enhancement: vibrant colors + sharp edges</li>
          <li>Text overlays positioned over images</li>
        </ul>
      </div>
    </div>
  );
};
