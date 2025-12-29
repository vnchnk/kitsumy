import { useState } from 'react';
import { useEditorStore } from '../store';
import { ImageElement, NarrativeElement, DialogueElement, PAPER_SIZES, TailPosition } from '../types';
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

export const AIGeneratorPanel = () => {
  const { project, addCanvas, setActiveCanvas, addElements, setPaperSize } = useEditorStore();

  const [prompt, setPrompt] = useState('');
  const [maxPages, setMaxPages] = useState<number>(1);
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

    const SECONDS_PER_IMAGE = 12;
    const AVERAGE_PANELS = 35;
    const ARCHITECTURE_TIME = 30;
    const SCRIPTWRITING_TIME = 60;

    setProgress('Architecting the story...');
    setEstimatedTime(`Estimated total time: ${Math.ceil((ARCHITECTURE_TIME + SCRIPTWRITING_TIME + AVERAGE_PANELS * SECONDS_PER_IMAGE) / 60)} minutes`);

    const startTime = Date.now();

    try {
      const requestBody = {
        prompt: prompt.trim(),
        style: { visual: style, setting: 'realistic' },
        maxPages: maxPages,
      };

      const response = await fetch('http://localhost:3001/api/comic/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Failed to generate comic');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Generation failed');
      }

      // Fetch the full plan
      const planRes = await fetch(`http://localhost:3001/api/comic/plan/${result.planId}`);
      const planJson = await planRes.json();

      if (!planJson.success || !planJson.plan) {
        throw new Error('Failed to fetch plan');
      }

      const elapsedMinutes = Math.ceil((Date.now() - startTime) / 60000);
      setProgress(`Converting to pages... (Generated in ${elapsedMinutes} min)`);
      setEstimatedTime('');

      await convertPlanToProject(planJson.plan);

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

  const convertPlanToProject = async (plan: any) => {
    if (!project) return;

    const { setProjectTitle } = useEditorStore.getState();
    setProjectTitle(plan.title);
    setPaperSize('A4');

    const paperSize = PAPER_SIZES['A4'];
    const MARGIN = 30;
    const GAP = 12;
    const availableWidth = paperSize.width - MARGIN * 2;
    const availableHeight = paperSize.height - MARGIN * 2;

    // Flatten all panels from all chapters/pages
    const allPanels: any[] = [];
    for (const chapter of plan.chapters) {
      for (const page of chapter.pages) {
        for (const panel of page.panels) {
          allPanels.push(panel);
        }
      }
    }

    // Group panels into pages (3-4 per page)
    const pageGroups: any[][] = [];
    let i = 0;
    while (i < allPanels.length) {
      const remaining = allPanels.length - i;
      let panelsInPage = remaining >= 4 ? 4 : remaining;
      if (remaining === 5) panelsInPage = 3; // Avoid single panel on last page
      pageGroups.push(allPanels.slice(i, i + panelsInPage));
      i += panelsInPage;
    }

    const getLayoutForPanels = (count: number) => {
      if (count === 1) {
        return [{ x: 0, y: 0, w: 1, h: 1 }];
      } else if (count === 2) {
        return [
          { x: 0, y: 0, w: 1, h: 0.48 },
          { x: 0, y: 0.52, w: 1, h: 0.48 },
        ];
      } else if (count === 3) {
        return [
          { x: 0, y: 0, w: 1, h: 0.45 },
          { x: 0, y: 0.48, w: 0.48, h: 0.52 },
          { x: 0.52, y: 0.48, w: 0.48, h: 0.52 },
        ];
      } else if (count === 4) {
        return [
          { x: 0, y: 0, w: 0.48, h: 0.48 },
          { x: 0.52, y: 0, w: 0.48, h: 0.48 },
          { x: 0, y: 0.52, w: 0.48, h: 0.48 },
          { x: 0.52, y: 0.52, w: 0.48, h: 0.48 },
        ];
      }
      return [];
    };

    for (let pageIndex = 0; pageIndex < pageGroups.length; pageIndex++) {
      const panelsOnPage = pageGroups[pageIndex];

      addCanvas();

      const canvases = useEditorStore.getState().project?.canvases || [];
      const newCanvas = canvases[canvases.length - 1];
      if (!newCanvas) continue;

      setActiveCanvas(newCanvas.id);

      const layout = getLayoutForPanels(panelsOnPage.length);
      const elements: (ImageElement | NarrativeElement | DialogueElement)[] = [];

      for (let panelIndex = 0; panelIndex < panelsOnPage.length; panelIndex++) {
        const panel = panelsOnPage[panelIndex];
        const layoutSpec = layout[panelIndex];
        if (!layoutSpec) continue;

        const baseZIndex = panelIndex * 10;

        const panelX = MARGIN + layoutSpec.x * availableWidth;
        const panelY = MARGIN + layoutSpec.y * availableHeight;
        const panelW = layoutSpec.w * availableWidth - (layoutSpec.x > 0 ? GAP / 2 : 0) - (layoutSpec.x + layoutSpec.w < 1 ? GAP / 2 : 0);
        const panelH = layoutSpec.h * availableHeight - (layoutSpec.y > 0 ? GAP / 2 : 0) - (layoutSpec.y + layoutSpec.h < 1 ? GAP / 2 : 0);

        // Image element
        const imageElement: ImageElement = {
          id: createId(),
          type: 'image',
          x: Math.round(panelX),
          y: Math.round(panelY),
          width: Math.round(panelW),
          height: Math.round(panelH),
          rotation: 0,
          zIndex: baseZIndex,
          imageUrl: panel.imageUrl || '',
          borderWidth: 4,
          borderColor: '#000000',
          borderStyle: 'clean',
          sepiaLevel: 0.15,
          clipPreset: 'none',
          customClipPath: null,
          showOverlay: true,
        };
        elements.push(imageElement);

        // Narrative element
        let narrativeHeight = 0;
        if (panel.narrative && panel.narrative.trim()) {
          const narrativeDims = calculateBubbleDimensions({
            text: panel.narrative,
            fontSize: 11,
            fontFamily: 'comic',
            maxWidth: panelW * 0.75,
            maxHeight: panelH * 0.25,
            padding: 10,
            tailHeight: 0,
            minWidth: 100,
            minHeight: 35,
          });

          const narrativePos = constrainBubblePosition(
            panelX + (panelW - narrativeDims.width) / 2,
            panelY + 10,
            narrativeDims.width,
            narrativeDims.height,
            panelX, panelY, panelW, panelH,
            8
          );

          narrativeHeight = narrativeDims.height;

          const narrativeElement: NarrativeElement = {
            id: createId(),
            type: 'narrative',
            x: Math.round(narrativePos.x),
            y: Math.round(narrativePos.y),
            width: Math.round(narrativeDims.width),
            height: Math.round(narrativeDims.height),
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

        // Dialogue bubbles
        const dialogues = panel.dialogue || [];
        const dialogueBubbles: Array<{
          x: number; y: number; width: number; height: number;
          text: string; speaker: string; fontSize: number;
          tailPosition: TailPosition;
        }> = [];

        dialogues.forEach((dia: any) => {
          const bubbleDims = calculateBubbleDimensions({
            text: dia.text,
            fontSize: 12,
            fontFamily: 'comic',
            maxWidth: panelW * 0.45,
            maxHeight: panelH * 0.35,
            padding: 12,
            tailHeight: 20,
            minWidth: 80,
            minHeight: 50,
          });

          dialogueBubbles.push({
            x: 0,
            y: 0,
            width: bubbleDims.width,
            height: bubbleDims.height,
            text: dia.text,
            speaker: dia.characterId || 'Unknown',
            fontSize: bubbleDims.fontSize,
            tailPosition: 'bottom-center',
          });
        });

        if (dialogueBubbles.length > 0) {
          const initialPositions = dialogueBubbles.map((bubble, diaIndex) => {
            const hasNarrative = narrativeHeight > 0;
            const safeTopY = hasNarrative ? panelY + narrativeHeight + 15 : panelY + 10;

            let x, y;
            if (diaIndex === 0) {
              x = panelX + 10;
              y = hasNarrative ? panelY + panelH - bubble.height - 10 : safeTopY;
            } else if (diaIndex === 1) {
              x = panelX + panelW - bubble.width - 10;
              y = hasNarrative ? panelY + panelH - bubble.height - 10 : safeTopY;
            } else {
              x = panelX + panelW - bubble.width - 10;
              y = panelY + (panelH - bubble.height) / 2;
            }

            return { ...bubble, x, y };
          });

          const distributedPositions = distributeBubbles(
            initialPositions,
            panelX, panelY, panelW, panelH
          );

          dialogueBubbles.forEach((bubble, i) => {
            const pos = distributedPositions[i];
            if (pos) {
              bubble.x = pos.x;
              bubble.y = pos.y;

              const bubbleCenterX = pos.x + bubble.width / 2;
              const bubbleCenterY = pos.y + bubble.height / 2;
              const panelCenterX = panelX + panelW / 2;
              const panelCenterY = panelY + panelH / 2;

              if (bubbleCenterY < panelCenterY) {
                if (bubbleCenterX < panelCenterX - panelW * 0.15) {
                  bubble.tailPosition = 'bottom-right';
                } else if (bubbleCenterX > panelCenterX + panelW * 0.15) {
                  bubble.tailPosition = 'bottom-left';
                } else {
                  bubble.tailPosition = 'bottom-center';
                }
              } else {
                if (bubbleCenterX < panelCenterX - panelW * 0.15) {
                  bubble.tailPosition = 'top-right';
                } else if (bubbleCenterX > panelCenterX + panelW * 0.15) {
                  bubble.tailPosition = 'top-left';
                } else {
                  bubble.tailPosition = 'top-center';
                }
              }
            }
          });
        }

        dialogueBubbles.forEach((bubble, diaIndex) => {
          const dialogueElement: DialogueElement = {
            id: createId(),
            type: 'dialogue',
            x: Math.round(bubble.x),
            y: Math.round(bubble.y),
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
            tailPosition: bubble.tailPosition,
            bubbleStyle: 'round',
          };
          elements.push(dialogueElement);
        });
      }

      addElements(elements);
    }

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
          <li>AI creates story with characters and panels</li>
          <li>Images generated via FLUX Kontext</li>
          <li>Panels arranged 3-4 per page</li>
          <li>Text bubbles positioned automatically</li>
        </ul>
      </div>
    </div>
  );
};
