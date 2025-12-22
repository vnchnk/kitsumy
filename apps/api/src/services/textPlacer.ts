/**
 * Vision-based Text Placement Service
 *
 * Analyzes generated images using Claude Vision to determine optimal
 * placement positions for dialogue bubbles and narrative boxes.
 * Returns precise coordinates (0-100%) and tail direction.
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Tail direction for speech bubbles
export type TailDirection =
  | 'top-left' | 'top-center' | 'top-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'
  | 'left-top' | 'left-center' | 'left-bottom'
  | 'right-top' | 'right-center' | 'right-bottom'
  | 'none';

// Schema for precise placement response
const precisePlacementSchema = z.object({
  placements: z.array(z.object({
    id: z.string(),
    x: z.number().min(0).max(100),        // X position in % (0 = left, 100 = right)
    y: z.number().min(0).max(100),        // Y position in % (0 = top, 100 = bottom)
    width: z.number().min(5).max(60),     // Suggested width in % of panel
    height: z.number().min(5).max(40),    // Suggested height in % of panel
    tailDirection: z.string(),            // Direction tail should point
    reason: z.string(),
  })),
});

export interface TextBlock {
  id: string;
  type: 'dialogue' | 'narrative' | 'sfx';
  text: string;
  speaker?: string;
}

export interface PrecisePlacement {
  id: string;
  x: number;           // 0-100%
  y: number;           // 0-100%
  width: number;       // 0-100%
  height: number;      // 0-100%
  tailDirection: TailDirection;
  reason: string;
}

export interface TextPlacementResponse {
  placements: PrecisePlacement[];
}

export class TextPlacer {
  private model: ChatAnthropic;

  constructor() {
    this.model = new ChatAnthropic({
      modelName: 'claude-sonnet-4-20250514',
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      maxTokens: 2048,
    });
  }

  /**
   * Detect image media type from base64 data
   */
  private detectMediaType(base64: string): 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' {
    if (base64.startsWith('iVBORw0KGgo')) {
      return 'image/png';
    } else if (base64.startsWith('/9j/') || base64.startsWith('/9k/') || base64.startsWith('/9l/')) {
      return 'image/jpeg';
    } else if (base64.startsWith('UklGR')) {
      return 'image/webp';
    } else if (base64.startsWith('R0lGOD')) {
      return 'image/gif';
    }
    return 'image/jpeg';
  }

  /**
   * Normalize tail direction from Claude's response
   */
  private normalizeTailDirection(dir: string): TailDirection {
    const normalized = dir.toLowerCase().trim();

    // Map common variations
    const mapping: Record<string, TailDirection> = {
      'top-left': 'top-left',
      'top-center': 'top-center',
      'top-right': 'top-right',
      'bottom-left': 'bottom-left',
      'bottom-center': 'bottom-center',
      'bottom-right': 'bottom-right',
      'left-top': 'left-top',
      'left-center': 'left-center',
      'left-bottom': 'left-bottom',
      'right-top': 'right-top',
      'right-center': 'right-center',
      'right-bottom': 'right-bottom',
      'none': 'none',
      // Shortcuts
      'top': 'top-center',
      'bottom': 'bottom-center',
      'left': 'left-center',
      'right': 'right-center',
      'down': 'bottom-center',
      'up': 'top-center',
      // For narrative boxes
      'n/a': 'none',
      'na': 'none',
      '': 'none',
    };

    return mapping[normalized] || 'bottom-center';
  }

  /**
   * Analyze image and determine precise text placement
   */
  async analyzeImage(
    imageBase64: string,
    textBlocks: TextBlock[],
    panelAspectRatio: string = '1:1'
  ): Promise<TextPlacementResponse> {
    if (textBlocks.length === 0) {
      return { placements: [] };
    }

    const textBlocksDescription = textBlocks.map((block) => {
      const textPreview = block.text.substring(0, 60) + (block.text.length > 60 ? '...' : '');
      const charCount = block.text.length;

      if (block.type === 'dialogue') {
        return `- ${block.id}: DIALOGUE from "${block.speaker || 'unknown'}" (${charCount} chars): "${textPreview}"`;
      } else if (block.type === 'narrative') {
        return `- ${block.id}: NARRATIVE box (${charCount} chars): "${textPreview}"`;
      } else {
        return `- ${block.id}: SFX (${charCount} chars): "${textPreview}"`;
      }
    }).join('\n');

    const prompt = `You are a professional comic book letterer. Analyze this comic panel and determine PRECISE placement for text elements.

PANEL ASPECT RATIO: ${panelAspectRatio}

TEXT BLOCKS TO PLACE:
${textBlocksDescription}

COORDINATE SYSTEM:
- x: 0 = left edge, 100 = right edge (position of bubble's LEFT edge)
- y: 0 = top edge, 100 = bottom edge (position of bubble's TOP edge)
- width/height: percentage of panel size

TAIL DIRECTION (where the tail points TO, toward the speaker):
- Options: top-left, top-center, top-right, bottom-left, bottom-center, bottom-right, left-top, left-center, left-bottom, right-top, right-center, right-bottom
- For narrative/SFX: use "none"

CRITICAL RULES (MUST FOLLOW):

1. **FACE DETECTION - ABSOLUTELY CRITICAL**:
   - First, identify WHERE the face is in the image (estimate x, y coordinates of face center)
   - NEVER place bubbles where they would overlap with face bounding box
   - Face typically occupies: eyes (y: 25-45%), nose (y: 40-55%), mouth (y: 50-65%)

2. **ABSOLUTELY NEVER** place ANY text over:
   - Faces (eyes, nose, mouth, forehead, cheeks, chin)
   - Hands and fingers
   - Important action or movement

3. **For CLOSE-UP or PORTRAIT shots** (face fills >40% of panel):
   - Place text in CORNERS ONLY: top-left (x:2-5, y:2-8) or top-right (x:60-75, y:2-8)
   - If face is centered: use LEFT corner (x:2-5) or RIGHT corner depending on where face is NOT
   - If face is on LEFT: place bubble on RIGHT (x:60-75, y:2-10)
   - If face is on RIGHT: place bubble on LEFT (x:2-10, y:2-10)
   - Use smaller bubbles (width: 25-35%, height: 8-15%)

4. **For WIDE/MEDIUM shots**:
   - Look for empty areas: sky, walls, floors, shadows
   - Place near but NOT ON characters
   - Prefer corners and edges

5. **Bubble sizing**:
   - Short text (<30 chars): width 20-28%, height 10-15%
   - Medium text (30-60 chars): width 28-38%, height 12-20%
   - Long text (>60 chars): width 35-45%, height 18-28%

6. **General**:
   - Keep within bounds: x + width <= 95, y + height <= 95
   - Reading order: top-to-bottom, left-to-right
   - Don't overlap bubbles with each other
   - Narrative boxes: corners preferred, no tail

Return ONLY valid JSON:
{
  "placements": [
    {
      "id": "dialogue-0",
      "x": 5,
      "y": 3,
      "width": 28,
      "height": 18,
      "tailDirection": "bottom-right",
      "reason": "Empty sky area, tail points to character below-right"
    }
  ]
}`;

    try {
      const message = new HumanMessage({
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${this.detectMediaType(imageBase64)};base64,${imageBase64}`,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      });

      const response = await this.model.invoke([message]);

      const responseText = typeof response.content === 'string'
        ? response.content
        : response.content.map((c: { type: string; text?: string }) => c.type === 'text' ? c.text : '').join('');

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const validated = precisePlacementSchema.parse(parsed);

      return {
        placements: validated.placements.map(p => ({
          id: p.id,
          x: Math.max(0, Math.min(100, p.x)),
          y: Math.max(0, Math.min(100, p.y)),
          width: Math.max(10, Math.min(50, p.width)),
          height: Math.max(8, Math.min(35, p.height)),
          tailDirection: this.normalizeTailDirection(p.tailDirection),
          reason: p.reason,
        })),
      };
    } catch (error) {
      console.error('[TextPlacer] Error analyzing image:', error);
      return this.getDefaultPlacements(textBlocks);
    }
  }

  /**
   * Fallback placement when Vision analysis fails
   */
  private getDefaultPlacements(textBlocks: TextBlock[]): TextPlacementResponse {
    const placements: PrecisePlacement[] = [];

    // Default positions for up to 4 elements
    const defaultPositions = [
      { x: 5, y: 5, width: 30, height: 15, tail: 'bottom-right' as TailDirection },
      { x: 65, y: 5, width: 30, height: 15, tail: 'bottom-left' as TailDirection },
      { x: 5, y: 75, width: 30, height: 15, tail: 'top-right' as TailDirection },
      { x: 65, y: 75, width: 30, height: 15, tail: 'top-left' as TailDirection },
    ];

    textBlocks.forEach((block, i) => {
      const pos = defaultPositions[i % defaultPositions.length];

      placements.push({
        id: block.id,
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        tailDirection: block.type === 'narrative' ? 'none' : pos.tail,
        reason: 'Default fallback placement',
      });
    });

    return { placements };
  }

  /**
   * Convert percentage placement to pixel coordinates
   */
  static toPixels(
    placement: PrecisePlacement,
    panelWidth: number,
    panelHeight: number
  ): { x: number; y: number; width: number; height: number } {
    return {
      x: Math.round((placement.x / 100) * panelWidth),
      y: Math.round((placement.y / 100) * panelHeight),
      width: Math.round((placement.width / 100) * panelWidth),
      height: Math.round((placement.height / 100) * panelHeight),
    };
  }
}

export const textPlacer = new TextPlacer();
