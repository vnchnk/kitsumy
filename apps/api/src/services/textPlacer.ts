/**
 * Vision-based Text Placement Service
 *
 * Analyzes generated images using Claude Vision to determine optimal
 * placement positions for dialogue bubbles and narrative boxes.
 * Returns precise coordinates (0-100%) and tail direction.
 *
 * Now includes smart text measurement to ensure bubbles are properly sized.
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Rate limiting configuration
const RATE_LIMIT_DELAY_MS = 3000; // 3 seconds between requests
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds on rate limit error

// Simple queue for rate limiting
let lastRequestTime = 0;

async function rateLimitedDelay(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
}

// ============================================
// Smart Text Sizing Utilities
// ============================================

// Cyrillic characters are slightly wider
const CYRILLIC_WIDTH_FACTOR = 1.08;

function hasCyrillic(text: string): boolean {
  return /[\u0400-\u04FF]/.test(text);
}

/**
 * Estimate optimal bubble size based on text content (in percentages)
 */
function estimateBubbleSize(
  text: string,
  type: 'dialogue' | 'narrative' | 'sfx',
  panelAspectRatio: string = '1:1'
): { width: number; height: number } {
  const charCount = text.length;
  const hasCyr = hasCyrillic(text);
  const widthFactor = hasCyr ? CYRILLIC_WIDTH_FACTOR : 1;

  // Parse aspect ratio
  const [w, h] = panelAspectRatio.split(':').map(Number);
  const aspectRatio = w / h || 1;

  // Base sizing by text length
  let baseWidth: number;
  let baseHeight: number;

  if (type === 'sfx') {
    // SFX are usually short and bold
    baseWidth = Math.min(35, 15 + charCount * 1.5);
    baseHeight = Math.min(20, 10 + charCount * 0.5);
  } else if (type === 'narrative') {
    // Narrative boxes are wider, less tall
    if (charCount < 30) {
      baseWidth = 25 + charCount * 0.4;
      baseHeight = 10 + Math.ceil(charCount / 20) * 5;
    } else if (charCount < 80) {
      baseWidth = 35 + charCount * 0.2;
      baseHeight = 12 + Math.ceil(charCount / 25) * 4;
    } else {
      baseWidth = 45;
      baseHeight = 18 + Math.ceil(charCount / 30) * 3;
    }
  } else {
    // Dialogue bubbles - need room for tail
    if (charCount < 20) {
      // Very short text
      baseWidth = 18 + charCount * 0.5;
      baseHeight = 12 + Math.ceil(charCount / 15) * 4;
    } else if (charCount < 40) {
      // Short text
      baseWidth = 22 + charCount * 0.35;
      baseHeight = 14 + Math.ceil(charCount / 18) * 4;
    } else if (charCount < 70) {
      // Medium text
      baseWidth = 28 + charCount * 0.25;
      baseHeight = 16 + Math.ceil(charCount / 22) * 4;
    } else {
      // Long text
      baseWidth = 35 + Math.min(charCount * 0.15, 10);
      baseHeight = 20 + Math.ceil(charCount / 28) * 3;
    }
  }

  // Apply cyrillic width factor
  baseWidth *= widthFactor;

  // Adjust for panel aspect ratio (wider panels = can use wider bubbles)
  if (aspectRatio > 1.5) {
    baseWidth *= 0.9; // Wide panel - use relatively narrower bubbles
    baseHeight *= 1.1;
  } else if (aspectRatio < 0.7) {
    baseWidth *= 1.1; // Tall panel - use relatively wider bubbles
    baseHeight *= 0.9;
  }

  // Apply constraints
  const width = Math.max(15, Math.min(50, baseWidth));
  const height = Math.max(10, Math.min(35, baseHeight));

  return { width: Math.round(width), height: Math.round(height) };
}

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

    // Calculate optimal sizes for each text block
    const textBlocksWithSizes = textBlocks.map((block) => {
      const size = estimateBubbleSize(block.text, block.type, panelAspectRatio);
      return { ...block, suggestedWidth: size.width, suggestedHeight: size.height };
    });

    const textBlocksDescription = textBlocksWithSizes.map((block) => {
      const textPreview = block.text.substring(0, 60) + (block.text.length > 60 ? '...' : '');
      const charCount = block.text.length;

      if (block.type === 'dialogue') {
        return `- ${block.id}: DIALOGUE from "${block.speaker || 'unknown'}" (${charCount} chars, REQUIRED SIZE: ${block.suggestedWidth}x${block.suggestedHeight}%): "${textPreview}"`;
      } else if (block.type === 'narrative') {
        return `- ${block.id}: NARRATIVE box (${charCount} chars, REQUIRED SIZE: ${block.suggestedWidth}x${block.suggestedHeight}%): "${textPreview}"`;
      } else {
        return `- ${block.id}: SFX (${charCount} chars, REQUIRED SIZE: ${block.suggestedWidth}x${block.suggestedHeight}%): "${textPreview}"`;
      }
    }).join('\n');

    const prompt = `You are a professional comic book letterer. Analyze this comic panel and determine PRECISE placement for text elements.

PANEL ASPECT RATIO: ${panelAspectRatio}

TEXT BLOCKS TO PLACE (with pre-calculated REQUIRED sizes):
${textBlocksDescription}

COORDINATE SYSTEM:
- x: 0 = left edge, 100 = right edge (position of bubble's LEFT edge)
- y: 0 = top edge, 100 = bottom edge (position of bubble's TOP edge)
- width/height: USE THE REQUIRED SIZE from each text block above!

TAIL DIRECTION (where the tail points TO, toward the speaker):
- Options: top-left, top-center, top-right, bottom-left, bottom-center, bottom-right, left-top, left-center, left-bottom, right-top, right-center, right-bottom
- For narrative/SFX: use "none"

CRITICAL RULES (MUST FOLLOW):

1. **USE REQUIRED SIZES**: Each text block has a REQUIRED SIZE (width x height). You MUST use these exact dimensions - they were calculated to fit the text properly.

2. **FACE DETECTION - ABSOLUTELY CRITICAL**:
   - First, identify WHERE faces are in the image (estimate x, y coordinates)
   - NEVER place bubbles where they would overlap with faces
   - Safe zones are typically: corners, sky areas, empty backgrounds

3. **ABSOLUTELY NEVER** place ANY text over:
   - Faces (eyes, nose, mouth, forehead, cheeks, chin)
   - Hands and fingers
   - Important action or movement

4. **For CLOSE-UP or PORTRAIT shots** (face fills >40% of panel):
   - Place text in CORNERS ONLY
   - If face is centered: use corner where face is NOT
   - If face is on LEFT: place bubble on RIGHT corner
   - If face is on RIGHT: place bubble on LEFT corner

5. **BOUNDARY CHECK**: Ensure placement stays within panel:
   - x + width <= 98 (leave 2% margin on right)
   - y + height <= 98 (leave 2% margin on bottom)
   - x >= 2 (leave 2% margin on left)
   - y >= 2 (leave 2% margin on top)

6. **For WIDE/MEDIUM shots**:
   - Look for empty areas: sky, walls, floors, shadows
   - Place near but NOT ON characters
   - Prefer corners and edges

7. **General**:
   - Reading order: top-to-bottom, left-to-right for multiple bubbles
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

    // Retry loop with rate limiting
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Wait for rate limit
        await rateLimitedDelay();

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
          placements: validated.placements.map(p => {
            // Find the pre-calculated size for this block
            const blockWithSize = textBlocksWithSizes.find(b => b.id === p.id);
            const suggestedWidth = blockWithSize?.suggestedWidth || p.width;
            const suggestedHeight = blockWithSize?.suggestedHeight || p.height;

            // Use Claude's suggested size if it's close to our calculation, otherwise use our calculation
            // This allows Claude some flexibility while ensuring text fits
            const widthDiff = Math.abs(p.width - suggestedWidth);
            const heightDiff = Math.abs(p.height - suggestedHeight);
            const finalWidth = widthDiff <= 5 ? p.width : suggestedWidth;
            const finalHeight = heightDiff <= 5 ? p.height : suggestedHeight;

            // Constrain position to ensure bubble stays within bounds
            let x = Math.max(2, p.x);
            let y = Math.max(2, p.y);

            // Ensure bubble doesn't overflow right/bottom edges
            if (x + finalWidth > 98) {
              x = Math.max(2, 98 - finalWidth);
            }
            if (y + finalHeight > 98) {
              y = Math.max(2, 98 - finalHeight);
            }

            return {
              id: p.id,
              x: Math.round(x),
              y: Math.round(y),
              width: Math.round(finalWidth),
              height: Math.round(finalHeight),
              tailDirection: this.normalizeTailDirection(p.tailDirection),
              reason: p.reason,
            };
          }),
        };
      } catch (error: unknown) {
        const isRateLimit = error instanceof Error &&
          (error.message.includes('rate_limit') || error.message.includes('429'));

        if (isRateLimit && attempt < MAX_RETRIES) {
          console.log(`[TextPlacer] Rate limited, waiting ${RETRY_DELAY_MS}ms before retry ${attempt + 1}/${MAX_RETRIES}`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          continue;
        }

        console.error('[TextPlacer] Error analyzing image:', error);
        return this.getDefaultPlacements(textBlocks, panelAspectRatio);
      }
    }

    // Fallback if all retries failed
    return this.getDefaultPlacements(textBlocks, panelAspectRatio);
  }

  /**
   * Fallback placement when Vision analysis fails
   */
  private getDefaultPlacements(textBlocks: TextBlock[], panelAspectRatio: string = '1:1'): TextPlacementResponse {
    const placements: PrecisePlacement[] = [];

    // Default corner positions
    const defaultCorners = [
      { x: 5, y: 5, tail: 'bottom-right' as TailDirection },
      { x: 55, y: 5, tail: 'bottom-left' as TailDirection },
      { x: 5, y: 65, tail: 'top-right' as TailDirection },
      { x: 55, y: 65, tail: 'top-left' as TailDirection },
    ];

    textBlocks.forEach((block, i) => {
      // Calculate proper size based on text
      const size = estimateBubbleSize(block.text, block.type, panelAspectRatio);
      const corner = defaultCorners[i % defaultCorners.length];

      // Adjust position based on calculated size to stay within bounds
      let x = corner.x;
      let y = corner.y;

      if (x + size.width > 98) {
        x = Math.max(2, 98 - size.width);
      }
      if (y + size.height > 98) {
        y = Math.max(2, 98 - size.height);
      }

      placements.push({
        id: block.id,
        x,
        y,
        width: size.width,
        height: size.height,
        tailDirection: block.type === 'narrative' ? 'none' : corner.tail,
        reason: 'Default fallback placement with calculated size',
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
