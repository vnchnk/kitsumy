/**
 * Smart text measurement utility for speech bubbles
 *
 * Calculates optimal bubble dimensions based on:
 * - Text content and length
 * - Font family and size
 * - Available panel space
 * - Minimum/maximum constraints
 */

export interface TextMeasureOptions {
  text: string;
  fontSize: number;
  fontFamily: 'comic' | 'serif' | 'sans';
  maxWidth: number;       // Maximum available width in pixels
  maxHeight: number;      // Maximum available height in pixels
  padding?: number;       // Internal padding (default: 12)
  tailHeight?: number;    // Space for tail (default: 20)
  minWidth?: number;      // Minimum bubble width
  minHeight?: number;     // Minimum bubble height
  bubbleStyle?: 'speech' | 'thought' | 'shout'; // Bubble style affects usable area
}

export interface BubbleDimensions {
  width: number;
  height: number;
  lines: number;
  fontSize: number;       // May be reduced if text doesn't fit
}

// Font family to CSS mapping
const FONT_MAP: Record<string, string> = {
  comic: '"Comic Neue", "Comic Sans MS", cursive',
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'Arial, Helvetica, sans-serif',
};

// Average character width ratio (char width / font size)
// These are approximations for common fonts
const CHAR_WIDTH_RATIO: Record<string, number> = {
  comic: 0.52,
  serif: 0.48,
  sans: 0.50,
};

// Cyrillic characters are slightly wider
const CYRILLIC_WIDTH_FACTOR = 1.08;

/**
 * Check if text contains Cyrillic characters
 */
function hasCyrillic(text: string): boolean {
  return /[\u0400-\u04FF]/.test(text);
}

/**
 * Estimate text width without DOM measurement
 */
function estimateTextWidth(text: string, fontSize: number, fontFamily: string): number {
  const baseRatio = CHAR_WIDTH_RATIO[fontFamily] || 0.50;
  const cyrillicFactor = hasCyrillic(text) ? CYRILLIC_WIDTH_FACTOR : 1;
  return text.length * fontSize * baseRatio * cyrillicFactor;
}

/**
 * Measure text using canvas (more accurate)
 */
function measureTextCanvas(text: string, fontSize: number, fontFamily: string): number {
  // Create offscreen canvas for measurement
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return estimateTextWidth(text, fontSize, fontFamily);

  ctx.font = `${fontSize}px ${FONT_MAP[fontFamily] || fontFamily}`;
  const metrics = ctx.measureText(text);
  return metrics.width;
}

/**
 * Word wrap text to fit within maxWidth
 */
function wrapText(
  text: string,
  fontSize: number,
  fontFamily: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = measureTextCanvas(testLine, fontSize, fontFamily);

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Calculate optimal bubble dimensions for given text
 */
export function calculateBubbleDimensions(options: TextMeasureOptions): BubbleDimensions {
  const {
    text,
    fontSize: initialFontSize,
    fontFamily,
    maxWidth,
    maxHeight,
    padding = 12,
    tailHeight = 20,
    minWidth = 60,
    minHeight = 40,
    bubbleStyle = 'speech',
  } = options;

  // Shout bubbles (starburst) only use ~50% of area for text
  // So we need to make them ~2x larger than speech bubbles
  const shoutMultiplier = bubbleStyle === 'shout' ? 2.0 : 1.0;

  // If no text, return minimum size
  if (!text.trim()) {
    return {
      width: minWidth,
      height: minHeight,
      lines: 0,
      fontSize: initialFontSize,
    };
  }

  let fontSize = initialFontSize;
  const lineHeight = 1.3;

  // Available content area (excluding padding and tail)
  const contentMaxWidth = maxWidth - padding * 2;
  const contentMaxHeight = maxHeight - padding * 2 - tailHeight;

  // Try to fit text, reducing font size if needed
  let lines: string[] = [];
  let attempts = 0;
  const minFontSize = 8;

  while (attempts < 5 && fontSize >= minFontSize) {
    // Calculate optimal line width (aim for 2-4 lines for readability)
    const estimatedWidth = estimateTextWidth(text, fontSize, fontFamily);
    const targetLines = Math.max(2, Math.min(4, Math.ceil(estimatedWidth / contentMaxWidth)));
    const targetLineWidth = Math.min(contentMaxWidth, estimatedWidth / targetLines);

    // Wrap text
    lines = wrapText(text, fontSize, fontFamily, targetLineWidth);

    // Check if it fits in height
    const textHeight = lines.length * fontSize * lineHeight;

    if (textHeight <= contentMaxHeight) {
      break;
    }

    // Reduce font size and try again
    fontSize = Math.max(minFontSize, fontSize - 2);
    attempts++;
  }

  // Calculate final dimensions
  const lineHeightPx = fontSize * lineHeight;
  const textHeight = lines.length * lineHeightPx;

  // Find the widest line
  let maxLineWidth = 0;
  for (const line of lines) {
    const lineWidth = measureTextCanvas(line, fontSize, fontFamily);
    maxLineWidth = Math.max(maxLineWidth, lineWidth);
  }

  // Add padding and constraints
  // For shout bubbles, multiply dimensions to account for reduced usable area
  const bubbleWidth = Math.max(
    minWidth * shoutMultiplier,
    Math.min(maxWidth, (maxLineWidth + padding * 2) * shoutMultiplier)
  );

  const bubbleHeight = Math.max(
    minHeight * shoutMultiplier,
    Math.min(maxHeight, (textHeight + padding * 2 + (bubbleStyle === 'shout' ? 0 : tailHeight)) * shoutMultiplier)
  );

  return {
    width: Math.ceil(bubbleWidth),
    height: Math.ceil(bubbleHeight),
    lines: lines.length,
    fontSize,
  };
}

/**
 * Calculate bubble position ensuring it stays within panel bounds
 */
export function constrainBubblePosition(
  x: number,
  y: number,
  width: number,
  height: number,
  panelX: number,
  panelY: number,
  panelWidth: number,
  panelHeight: number,
  margin: number = 5
): { x: number; y: number } {
  // Ensure bubble stays within panel bounds
  const minX = panelX + margin;
  const maxX = panelX + panelWidth - width - margin;
  const minY = panelY + margin;
  const maxY = panelY + panelHeight - height - margin;

  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

/**
 * Distribute multiple bubbles to avoid overlap
 */
export function distributeBubbles(
  bubbles: Array<{ x: number; y: number; width: number; height: number }>,
  panelX: number,
  panelY: number,
  panelWidth: number,
  panelHeight: number
): Array<{ x: number; y: number }> {
  const result: Array<{ x: number; y: number }> = [];
  const placed: Array<{ x: number; y: number; width: number; height: number }> = [];

  for (const bubble of bubbles) {
    let { x, y } = bubble;
    const { width, height } = bubble;

    // Check for overlaps and adjust
    let hasOverlap = true;
    let attempts = 0;

    while (hasOverlap && attempts < 10) {
      hasOverlap = false;

      for (const other of placed) {
        // Check if rectangles overlap
        if (
          x < other.x + other.width &&
          x + width > other.x &&
          y < other.y + other.height &&
          y + height > other.y
        ) {
          hasOverlap = true;
          // Move down if there's space, otherwise move right
          if (y + height + height < panelY + panelHeight) {
            y = other.y + other.height + 5;
          } else if (x + width + width < panelX + panelWidth) {
            x = other.x + other.width + 5;
          } else {
            // Reset to top-right corner if no space
            x = panelX + panelWidth - width - 10;
            y = panelY + 10 + placed.length * (height + 5);
          }
          break;
        }
      }

      attempts++;
    }

    // Constrain to panel bounds
    const constrained = constrainBubblePosition(
      x, y, width, height,
      panelX, panelY, panelWidth, panelHeight
    );

    result.push(constrained);
    placed.push({ ...constrained, width, height });
  }

  return result;
}
