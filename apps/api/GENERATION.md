# Comic Generation Pipeline (generate-v2)

## Overview

Endpoint: `POST /api/comic/generate-v2`

Generates a complete comic with AI-planned story, generated images, and intelligent text placement.

## Input

```typescript
{
  prompt: string;                    // "A story about a detective in 1920s Chicago"
  style: {
    visual: ComicStyle;              // "noir", "manga", "american-classic", etc.
    setting?: ComicSetting;          // "realistic", "sci-fi", "fantasy", etc.
  };
  maxPages?: number;                 // 1-20, default: 5
  language?: 'uk' | 'en';            // default: 'uk'
  imageProvider?: 'replicate';       // Image generation provider
  skipImages?: boolean;              // Skip image generation (for testing)
}
```

## Pipeline Phases

### Phase 1: Story Planning (ComicPlanner)

**Service:** `comicPlanner.ts`
**AI Model:** Claude Sonnet (via LangChain)

Creates the complete comic structure:

1. **Character Creation** - Detailed character descriptions for visual consistency
   - Physical appearance (face, body, clothing)
   - Personality and role in story
   - Seed number for Flux consistency

2. **Story Outline** - Chapter structure with page breakdowns

3. **Panel Scripts** - For each panel:
   - `imagePrompt` - Ready-to-use prompt for Flux
   - `negativePrompt` - What to avoid
   - `dialogue[]` - Character dialogues
   - `narrative` - Narrator text boxes
   - `sfx` - Sound effects
   - `camera` - Shot type and angle
   - `aspectRatio` - From page layout template

**Output:** `ComicPlan` JSON with all story data (no images yet)

---

### Phase 2: Image Generation (ImageGenerator)

**Service:** `imageGenerator.ts`
**AI Model:** Flux Dev (via Replicate API)

Generates images for all panels in batch:

1. Collects all panels with their `imagePrompt` and `aspectRatio`
2. Generates images via Replicate API (with rate limiting)
3. Downloads generated images from Replicate URLs
4. Saves locally to `public/images/` (prevents URL expiration)
5. Updates `panel.imageUrl` with local URL

**Rate Limiting:** 12 second delay between requests (Replicate free tier)

**Local Storage:** Images saved as `{hash}.webp` to prevent duplicate downloads

---

### Phase 3: Text Placement Analysis (TextPlacer)

**Service:** `textPlacer.ts`
**AI Model:** Claude Sonnet Vision

Analyzes each generated image to find optimal text placement:

1. Downloads panel image, converts to base64
2. Sends to Claude Vision with text blocks info
3. Claude analyzes image and returns precise coordinates

**Input to Vision:**
```
- Image (base64)
- Text blocks: dialogues, narrative, SFX with character count
- Panel aspect ratio
```

**Output from Vision:**
```typescript
{
  placements: [{
    id: "dialogue-0",        // Which text block
    x: 5,                    // 0-100% from left
    y: 8,                    // 0-100% from top
    width: 28,               // Bubble width in %
    height: 15,              // Bubble height in %
    tailDirection: "bottom-right",  // Where tail points
    reason: "Empty sky area, tail points to character"
  }]
}
```

**Placement Rules (from prompt):**
- Place in EMPTY areas (sky, walls, shadows)
- NEVER cover faces, hands, eyes
- Dialogue near speaking character
- Tail points toward speaker's face
- Narrative boxes in corners (top-left preferred)
- Reading order: top-to-bottom, left-to-right

**Saved to Panel:**
```typescript
panel.dialogue[0].precisePlacement = { x, y, width, height, tailDirection }
panel.narrativePrecisePlacement = { ... }
panel.sfxPrecisePlacement = { ... }
```

---

## Output

```typescript
{
  success: true,
  planId: "abc123",
  title: "Detective in Chicago",
  filepath: "/apps/api/plans/abc123.json",
  pagesCount: 5,
  panelsCount: 15,
  charactersCount: 3,
  imagesGenerated: 15
}
```

**Saved JSON includes:**
- Complete story structure
- Character definitions
- Panel scripts with `imageUrl`
- Precise text placements (`precisePlacement`)

---

## Frontend Usage (store.ts)

When loading JSON in editor:

1. **Priority 1:** Use `precisePlacement` if available
   - Convert % to pixels based on panel size
   - Use AI-provided `width`, `height`, `tailDirection`

2. **Priority 2:** Use legacy `placement` (9-zone grid)
   - Convert zone name to pixel coordinates

3. **Priority 3:** Fallback collision-based placement
   - Try corners in pattern order
   - Avoid overlapping with other elements

---

## Key Files

| File | Purpose |
|------|---------|
| `apps/api/src/index.ts` | `/api/comic/generate-v2` endpoint |
| `apps/api/src/services/comicPlanner.ts` | Phase 1: Story planning |
| `apps/api/src/services/imageGenerator.ts` | Phase 2: Flux image generation |
| `apps/api/src/services/textPlacer.ts` | Phase 3: Vision text placement |
| `packages/types/src/index.ts` | TypeScript types |
| `apps/web/src/editor/store.ts` | Frontend JSON loading |

---

## Type Definitions

```typescript
// Precise placement from Vision AI
interface PrecisePlacement {
  x: number;           // 0-100%
  y: number;           // 0-100%
  width: number;       // 0-100%
  height: number;      // 0-100%
  tailDirection: TailDirection;
}

// Tail direction options
type TailDirection =
  | 'top-left' | 'top-center' | 'top-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'
  | 'left-top' | 'left-center' | 'left-bottom'
  | 'right-top' | 'right-center' | 'right-bottom'
  | 'none';

// Legacy 9-zone placement
type TextPlacement =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';
```

---

## Parallel Processing

- **Phase 1:** Sequential (single LLM call for story coherence)
- **Phase 2:** Batch with rate limiting (Replicate constraint)
- **Phase 3:** Parallel `Promise.all()` for all panels (fast)

---

## Error Handling

- **Phase 1 fails:** Returns error, no plan created
- **Phase 2 partial:** Continues, some panels without images
- **Phase 3 fails:** Falls back to default placements (corners)

---

## Example JSON Output

```json
{
  "id": "abc123",
  "title": "Detective Story",
  "chapters": [{
    "pages": [{
      "panels": [{
        "id": "ch1-p1-pan1",
        "imageUrl": "http://localhost:3001/images/xyz.webp",
        "dialogue": [{
          "characterId": "char-1",
          "text": "Something's not right here...",
          "precisePlacement": {
            "x": 5,
            "y": 3,
            "width": 30,
            "height": 18,
            "tailDirection": "bottom-right"
          }
        }],
        "narrative": "Chicago, 1925. The rain hadn't stopped for three days.",
        "narrativePrecisePlacement": {
          "x": 2,
          "y": 2,
          "width": 35,
          "height": 12,
          "tailDirection": "none"
        }
      }]
    }]
  }]
}
```
