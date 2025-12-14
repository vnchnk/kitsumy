import { useState } from 'react';
import { useEditorStore } from '../store';
import { ImageElement, NarrativeElement, DialogueElement, PAPER_SIZES } from '../types';
import { Sparkles, Loader2 } from 'lucide-react';

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

const PANELS_PER_PAGE = 3; // Fewer panels per page for better layout

export const AIGeneratorPanel = () => {
  const { project, addCanvas, setActiveCanvas, updateCanvas, addElements, setPaperSize } = useEditorStore();

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  const generateFromAI = async () => {
    if (!prompt.trim()) {
      setError('Please enter a topic');
      return;
    }

    setIsGenerating(true);
    setError(null);

    // Simulate progress updates
    const progressMessages = [
      'Architecting the story...',
      'Designing chapters with POV...',
      'Writing cinematic scripts...',
      'Generating images (batch 1)...',
      'Generating images (batch 2)...',
      'Generating images (batch 3)...',
      'Generating images (batch 4)...',
      'Downloading and saving images...',
      'Almost done...'
    ];

    let currentStep = 0;
    setProgress(progressMessages[0]);

    const progressInterval = setInterval(() => {
      currentStep++;
      if (currentStep < progressMessages.length) {
        setProgress(progressMessages[currentStep]);
      }
    }, 15000); // Update every 15 seconds

    try {
      const response = await fetch('http://localhost:3001/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'learning',
          prompt: prompt.trim(),
          userContext: {},
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error('Failed to generate comic');
      }

      const result: AIGenerationResponse = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Generation failed');
      }

      setProgress('Converting to pages...');
      await convertAIPanelsToProject(result.data);

      setProgress('Done!');
      setTimeout(() => {
        setPrompt('');
        setProgress('');
        setIsGenerating(false);
      }, 1000);

    } catch (err) {
      clearInterval(progressInterval);
      console.error('AI Generation error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsGenerating(false);
      setProgress('');
    }
  };

  const convertAIPanelsToProject = async (data: { title: string; panels: AIPanel[] }) => {
    if (!project) return;

    // Set project title
    const { setProjectTitle } = useEditorStore.getState();
    setProjectTitle(data.title);

    // Set paper size to A4 Portrait
    setPaperSize('A4');

    // Group panels into pages (PANELS_PER_PAGE panels per page)
    const pageGroups: AIPanel[][] = [];
    for (let i = 0; i < data.panels.length; i += PANELS_PER_PAGE) {
      pageGroups.push(data.panels.slice(i, i + PANELS_PER_PAGE));
    }

    const paperSize = PAPER_SIZES['A4'];
    const MARGIN = 30;
    const GAP = 12;
    const availableWidth = paperSize.width - MARGIN * 2;
    const availableHeight = paperSize.height - MARGIN * 2;

    // Layout templates for different panel counts
    const getLayoutForPanels = (count: number) => {
      if (count === 1) {
        // Single large panel
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
        if (panel.narrative && panel.narrative.trim()) {
          const narrativeW = Math.min(panelW * 0.7, 300);
          const narrativeH = 65;
          const narrativeElement: NarrativeElement = {
            id: createId(),
            type: 'narrative',
            x: Math.round(panelX + (panelW - narrativeW) / 2), // Center horizontally
            y: Math.round(panelY + 12),
            width: Math.round(narrativeW),
            height: narrativeH,
            rotation: -1,
            zIndex: baseZIndex + 5,
            text: panel.narrative,
            bgColor: '#fff9db',
            textColor: '#000000',
            borderColor: '#000000',
            borderWidth: 2,
            fontSize: 11,
            fontFamily: 'comic',
            padding: 10,
          };
          elements.push(narrativeElement);
        }

        // 3. Create Dialogue Bubbles OVER the image (positioned strategically)
        panel.dialogue.forEach((dia, diaIndex) => {
          const bubbleW = Math.min(panelW * 0.4, 200);
          const bubbleH = 85;

          // Position bubbles to avoid narrative box (which is top-center)
          let bubbleX, bubbleY;
          if (diaIndex === 0) {
            // Bottom-left corner
            bubbleX = panelX + 15;
            bubbleY = panelY + panelH - bubbleH - 15;
          } else if (diaIndex === 1) {
            // Bottom-right corner
            bubbleX = panelX + panelW - bubbleW - 15;
            bubbleY = panelY + panelH - bubbleH - 15;
          } else {
            // Middle-right (for 3rd bubble)
            bubbleX = panelX + panelW - bubbleW - 15;
            bubbleY = panelY + (panelH - bubbleH) / 2;
          }

          const dialogueElement: DialogueElement = {
            id: createId(),
            type: 'dialogue',
            x: Math.round(bubbleX),
            y: Math.round(bubbleY),
            width: Math.round(bubbleW),
            height: bubbleH,
            rotation: 0,
            zIndex: baseZIndex + 10 + diaIndex,
            speaker: dia.speaker,
            text: dia.text,
            bgColor: '#ffffff',
            textColor: '#000000',
            borderColor: '#000000',
            borderWidth: 3,
            fontSize: 12,
            tailPosition: diaIndex === 0 ? 'bottom-left' : diaIndex === 1 ? 'bottom-right' : 'left',
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
        <div className="text-[#3b82f6] text-xs bg-blue-900/20 border border-blue-900/50 rounded px-3 py-2 flex items-center gap-2">
          <Loader2 size={12} className="animate-spin" />
          {progress}
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
          <li>Images generated via DALL-E 3 (or placeholders)</li>
          <li>{PANELS_PER_PAGE} panels per page in comic layout</li>
          <li>Text overlays positioned over images</li>
        </ul>
      </div>
    </div>
  );
};
