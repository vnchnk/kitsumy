import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { ComicPlanner } from './services/comicPlanner.js';
import { ComicPlanRequest, ComicStyleConfig, ComicStyle, ComicSetting } from '@kitsumy/types';
import fs from 'fs';
import path from 'path';
import { textPlacer, TextBlock } from './services/textPlacer.js';
import { imageGenerator, ImageProvider, AspectRatio } from './services/imageGenerator.js';

const app = Fastify({ logger: false });
const comicPlanner = new ComicPlanner();

app.register(cors, { origin: '*' });

// Serve static files (generated images)
const PUBLIC_DIR = path.join(process.cwd(), 'public');
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}
app.register(fastifyStatic, {
  root: PUBLIC_DIR,
  prefix: '/',
});

// Plans directory for saving generated plans
const PLANS_DIR = path.join(process.cwd(), 'plans');

// Ensure plans directory exists
if (!fs.existsSync(PLANS_DIR)) {
  fs.mkdirSync(PLANS_DIR, { recursive: true });
}

// New endpoint - creates comic plan (JSON only, no images)
app.post('/api/comic/plan', async (request, reply) => {
  const body = request.body as any;

  // Validate required fields
  if (!body.prompt) {
    return reply.status(400).send({
      success: false,
      error: 'Missing required field: prompt'
    });
  }

  if (!body.style || !body.style.visual) {
    return reply.status(400).send({
      success: false,
      error: 'Missing required field: style.visual (e.g., { visual: "noir", setting: "realistic" })'
    });
  }

  try {
    const styleConfig: ComicStyleConfig = {
      visual: body.style.visual,
      setting: body.style.setting || 'realistic', // Default to realistic
    };

    const planRequest: ComicPlanRequest = {
      prompt: body.prompt,
      style: styleConfig,
      maxPages: body.maxPages,
      language: body.language,
    };

    const plan = await comicPlanner.createPlan(planRequest);

    return {
      success: true,
      plan: plan
    };
  } catch (err: any) {
    app.log.error(err);
    return reply.status(500).send({
      success: false,
      error: err.message || 'Planning failed'
    });
  }
});

// Generate comic plan with images and save to file
app.post('/api/comic/generate-v2', async (request, reply) => {
  const body = request.body as {
    prompt: string;
    style: { visual: ComicStyle; setting?: ComicSetting };
    maxPages?: number;
    language?: 'uk' | 'en';
    imageProvider?: ImageProvider;
    skipImages?: boolean; // Skip image generation (for testing)
  };

  // Validate required fields
  if (!body.prompt) {
    return reply.status(400).send({
      success: false,
      error: 'Missing required field: prompt'
    });
  }

  if (!body.style || !body.style.visual) {
    return reply.status(400).send({
      success: false,
      error: 'Missing required field: style.visual (e.g., { visual: "noir", setting: "realistic" })'
    });
  }

  try {
    const styleConfig: ComicStyleConfig = {
      visual: body.style.visual,
      setting: body.style.setting || 'realistic',
    };

    const planRequest: ComicPlanRequest = {
      prompt: body.prompt,
      style: styleConfig,
      maxPages: body.maxPages,
      language: body.language,
    };

    // Phase 1: Create comic plan
    console.log(`[generate-v2] Phase 1: Creating plan for: "${body.prompt}"`);
    const plan = await comicPlanner.createPlan(planRequest);

    // Count total panels
    let totalPanels = 0;
    for (const chapter of plan.chapters) {
      for (const page of chapter.pages) {
        totalPanels += page.panels.length;
      }
    }
    console.log(`[generate-v2] Plan created: ${plan.chapters.length} chapters, ${totalPanels} panels`);

    // Phase 2: Generate images for all panels
    if (!body.skipImages) {
      // Store character reference images (for Kontext mode)
      const characterReferences: Map<string, string> = new Map();

      // Use Kontext mode when IMAGE_PROVIDER is flux-kontext or runpod-flux-kontext
      const useKontextMode = process.env.IMAGE_PROVIDER === 'flux-kontext' ||
                             process.env.IMAGE_PROVIDER === 'runpod-flux-kontext';

      // Phase 2a: Generate character references if using Kontext
      if (useKontextMode) {
        console.log(`[generate-v2] Phase 2a: Generating ${plan.characters.length} character references for Kontext...`);

        for (const character of plan.characters) {
          try {
            // Build detailed character description for reference portrait
            const charDescription = `${character.age} year old ${character.gender}, ` +
              `${character.bodyType} build, ${character.height}, ` +
              `${character.skinTone} skin, ${character.face.hair}, ` +
              `${character.face.eyes}, ${character.face.distinctiveFeatures || ''}, ` +
              `wearing ${character.clothing}`;

            console.log(`[generate-v2]   └─ ${character.id}: ${character.name}...`);

            const refUrl = await imageGenerator.generateCharacterReference(
              charDescription,
              body.style.visual // Match comic style
            );

            characterReferences.set(character.id, refUrl);
            console.log(`[generate-v2]   └─ ✓ ${character.id} reference: ${refUrl}`);

            // Save reference URL to character object
            (character as any).referenceImage = refUrl;
          } catch (err: any) {
            console.error(`[generate-v2]   └─ ✗ ${character.id} failed: ${err.message}`);
          }
        }

        console.log(`[generate-v2] Phase 2a: ${characterReferences.size}/${plan.characters.length} character references created`);
      }

      console.log(`[generate-v2] Phase 2b: Generating ${totalPanels} panel images...`);

      // Collect all panels for batch generation
      const panelImages: Array<{
        id: string;
        prompt: string;
        negativePrompt?: string;
        aspectRatio?: AspectRatio;
        chapterIdx: number;
        pageIdx: number;
        panelIdx: number;
        referenceImage?: string; // For Kontext
      }> = [];

      for (let chIdx = 0; chIdx < plan.chapters.length; chIdx++) {
        const chapter = plan.chapters[chIdx];
        for (let pIdx = 0; pIdx < chapter.pages.length; pIdx++) {
          const page = chapter.pages[pIdx];
          for (let panIdx = 0; panIdx < page.panels.length; panIdx++) {
            const panel = page.panels[panIdx];

            // For Kontext: find the primary character's reference image
            let referenceImage: string | undefined;
            if (useKontextMode && panel.characters && panel.characters.length > 0) {
              // Use the first main character (char-*) as reference
              const mainCharId = panel.characters.find(c => c.characterId.startsWith('char-'))?.characterId;
              if (mainCharId) {
                referenceImage = characterReferences.get(mainCharId);
              }
            }

            panelImages.push({
              id: panel.id,
              prompt: panel.imagePrompt,
              negativePrompt: panel.negativePrompt,
              aspectRatio: panel.aspectRatio as AspectRatio,
              chapterIdx: chIdx,
              pageIdx: pIdx,
              panelIdx: panIdx,
              referenceImage,
            });
          }
        }
      }

      // Generate images - use Kontext if enabled, otherwise batch
      let batchResult;
      if (useKontextMode) {
        // Determine which Kontext provider to use
        const kontextProvider = process.env.IMAGE_PROVIDER === 'runpod-flux-kontext'
          ? 'runpod-flux-kontext'
          : 'flux-kontext';
        const isRunPod = kontextProvider === 'runpod-flux-kontext';

        // Kontext mode: generate with reference images
        console.log(`[generate-v2] Using ${kontextProvider} for character consistency...`);
        const results: Array<{ id: string; imageUrl: string; success: boolean; error?: string }> = [];

        for (let i = 0; i < panelImages.length; i++) {
          const p = panelImages[i];
          console.log(`[generate-v2] Panel ${i + 1}/${panelImages.length}: ${p.id}`);

          try {
            if (p.referenceImage) {
              // Use Kontext with reference
              const result = await imageGenerator.generate({
                prompt: p.prompt,
                referenceImage: p.referenceImage,
                aspectRatio: p.aspectRatio,
                provider: kontextProvider,
              });
              results.push({ id: p.id, imageUrl: result.imageUrl, success: true });
            } else {
              // No main character - use regular provider (no reference needed)
              const fallbackProvider = isRunPod ? 'runpod-flux' : 'flux-dev';
              const result = await imageGenerator.generate({
                prompt: p.prompt,
                negativePrompt: p.negativePrompt,
                aspectRatio: p.aspectRatio,
                provider: body.imageProvider || fallbackProvider,
              });
              results.push({ id: p.id, imageUrl: result.imageUrl, success: true });
            }
          } catch (err: any) {
            console.error(`[generate-v2] ✗ ${p.id}: ${err.message}`);
            results.push({ id: p.id, imageUrl: '', success: false, error: err.message });
          }

          // Rate limit delay for Replicate only (RunPod has no rate limit)
          if (!isRunPod && i < panelImages.length - 1) {
            console.log(`[generate-v2] Waiting 12s for rate limit...`);
            await new Promise(r => setTimeout(r, 12000));
          }
        }

        batchResult = {
          results,
          provider: kontextProvider as ImageProvider,
          totalGenerated: results.filter(r => r.success).length,
          totalFailed: results.filter(r => !r.success).length,
        };
      } else {
        // Standard batch mode (RunPod or Replicate)
        batchResult = await imageGenerator.generateBatch({
          images: panelImages.map(p => ({
            id: p.id,
            prompt: p.prompt,
            negativePrompt: p.negativePrompt,
            aspectRatio: p.aspectRatio,
          })),
          provider: body.imageProvider,
        });
      }

      // Update panels with generated image URLs
      for (const result of batchResult.results) {
        if (result.success && result.imageUrl) {
          const panelInfo = panelImages.find(p => p.id === result.id);
          if (panelInfo) {
            plan.chapters[panelInfo.chapterIdx].pages[panelInfo.pageIdx].panels[panelInfo.panelIdx].imageUrl = result.imageUrl;
          }
        }
      }

      console.log(`[generate-v2] Images: ${batchResult.totalGenerated} success, ${batchResult.totalFailed} failed`);

      // Phase 3: Analyze images and place text (parallel)
      console.log(`[generate-v2] Phase 3: Analyzing images for text placement...`);

      const analysisPromises = panelImages.map(async (panelInfo) => {
        const panel = plan.chapters[panelInfo.chapterIdx].pages[panelInfo.pageIdx].panels[panelInfo.panelIdx];

        // Skip if no image or no text to place
        if (!panel.imageUrl || (panel.dialogue.length === 0 && !panel.narrative)) {
          return;
        }

        try {
          // Download image and convert to base64
          const imageResponse = await fetch(panel.imageUrl);
          if (!imageResponse.ok) {
            console.log(`[generate-v2] Skip analysis for ${panel.id}: image fetch failed`);
            return;
          }
          const imageBuffer = await imageResponse.arrayBuffer();
          const imageBase64 = Buffer.from(imageBuffer).toString('base64');

          // Build text blocks for analysis
          const textBlocks: TextBlock[] = [];

          if (panel.narrative) {
            textBlocks.push({
              id: 'narrative',
              type: 'narrative',
              text: panel.narrative,
            });
          }

          panel.dialogue.forEach((dlg, idx) => {
            textBlocks.push({
              id: `dialogue-${idx}`,
              type: 'dialogue',
              text: dlg.text,
              speaker: dlg.characterId,
            });
          });

          if (panel.sfx) {
            textBlocks.push({
              id: 'sfx',
              type: 'sfx',
              text: panel.sfx,
            });
          }

          // Analyze with Vision
          const result = await textPlacer.analyzeImage(imageBase64, textBlocks, panel.aspectRatio);

          // Apply precise placements to panel
          for (const placement of result.placements) {
            const precisePlacement = {
              x: placement.x,
              y: placement.y,
              width: placement.width,
              height: placement.height,
              tailDirection: placement.tailDirection,
            };

            if (placement.id === 'narrative') {
              panel.narrativePrecisePlacement = precisePlacement;
            } else if (placement.id === 'sfx') {
              panel.sfxPrecisePlacement = precisePlacement;
            } else if (placement.id.startsWith('dialogue-')) {
              const idx = parseInt(placement.id.replace('dialogue-', ''));
              if (panel.dialogue[idx]) {
                panel.dialogue[idx].precisePlacement = precisePlacement;
              }
            }
          }

          console.log(`[generate-v2] ${panel.id}: placed ${result.placements.length} text blocks`);
        } catch (err) {
          console.log(`[generate-v2] ${panel.id}: analysis failed, using defaults`);
        }
      });

      await Promise.all(analysisPromises);
      console.log(`[generate-v2] Phase 3: Text placement complete`);
    }

    // Save plan to file
    const filename = `${plan.id}.json`;
    const filepath = path.join(PLANS_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(plan, null, 2), 'utf-8');
    console.log(`[generate-v2] Plan saved to: ${filepath}`);

    return {
      success: true,
      planId: plan.id,
      title: plan.title,
      filepath: filepath,
      pagesCount: plan.chapters.reduce((acc, ch) => acc + ch.pages.length, 0),
      panelsCount: totalPanels,
      charactersCount: plan.characters.length,
      imagesGenerated: body.skipImages ? 0 : totalPanels,
    };
  } catch (err: any) {
    app.log.error(err);
    return reply.status(500).send({
      success: false,
      error: err.message || 'Generation failed'
    });
  }
});

// Get saved plan by ID
app.get('/api/comic/plan/:id', async (request, reply) => {
  const { id } = request.params as { id: string };

  const filepath = path.join(PLANS_DIR, `${id}.json`);

  if (!fs.existsSync(filepath)) {
    return reply.status(404).send({
      success: false,
      error: `Plan not found: ${id}`
    });
  }

  try {
    const planData = fs.readFileSync(filepath, 'utf-8');
    const plan = JSON.parse(planData);

    return {
      success: true,
      plan: plan
    };
  } catch (err: any) {
    return reply.status(500).send({
      success: false,
      error: 'Failed to read plan file'
    });
  }
});

// List all saved plans
app.get('/api/comic/plans', async (request, reply) => {
  try {
    const files = fs.readdirSync(PLANS_DIR).filter(f => f.endsWith('.json'));

    const plans = files.map(filename => {
      const filepath = path.join(PLANS_DIR, filename);
      const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      return {
        id: data.id,
        title: data.title,
        style: data.style,
        createdAt: data.createdAt,
        pagesCount: data.chapters?.reduce((acc: number, ch: any) => acc + ch.pages.length, 0) || 0,
        charactersCount: data.characters?.length || 0,
      };
    });

    return {
      success: true,
      plans: plans
    };
  } catch (err: any) {
    return reply.status(500).send({
      success: false,
      error: 'Failed to list plans'
    });
  }
});

// Analyze image for optimal text placement using Vision LLM
app.post('/api/analyze-text-placement', async (request, reply) => {
  const body = request.body as {
    imageBase64: string;
    textBlocks: TextBlock[];
    aspectRatio?: string;
  };

  if (!body.imageBase64) {
    return reply.status(400).send({
      success: false,
      error: 'Missing required field: imageBase64'
    });
  }

  if (!body.textBlocks || !Array.isArray(body.textBlocks)) {
    return reply.status(400).send({
      success: false,
      error: 'Missing required field: textBlocks (array)'
    });
  }

  try {
    console.log(`[analyze-text-placement] Analyzing image for ${body.textBlocks.length} text blocks`);

    const result = await textPlacer.analyzeImage(
      body.imageBase64,
      body.textBlocks,
      body.aspectRatio || '1:1'
    );

    console.log(`[analyze-text-placement] Found placements:`, result.placements.map(p => `${p.id}:(${p.x},${p.y})`));

    return {
      success: true,
      ...result
    };
  } catch (err: any) {
    console.error('[analyze-text-placement] Error:', err);
    return reply.status(500).send({
      success: false,
      error: err.message || 'Analysis failed'
    });
  }
});

// ========================================
// IMAGE GENERATION ENDPOINTS
// ========================================

// Generate a single image
app.post('/api/image/generate', async (request, reply) => {
  const body = request.body as {
    prompt: string;
    negativePrompt?: string;
    aspectRatio?: AspectRatio;
    seed?: number;
    provider?: ImageProvider;
  };

  if (!body.prompt) {
    return reply.status(400).send({
      success: false,
      error: 'Missing required field: prompt'
    });
  }

  try {
    console.log(`[generate-image] Generating with prompt: "${body.prompt.substring(0, 80)}..."`);

    const result = await imageGenerator.generate({
      prompt: body.prompt,
      negativePrompt: body.negativePrompt,
      aspectRatio: body.aspectRatio,
      seed: body.seed,
      provider: body.provider,
    });

    return {
      success: true,
      ...result
    };
  } catch (err: any) {
    console.error('[generate-image] Error:', err);
    return reply.status(500).send({
      success: false,
      error: err.message || 'Image generation failed'
    });
  }
});

// Generate multiple images in batch
app.post('/api/image/generate-batch', async (request, reply) => {
  const body = request.body as {
    images: Array<{
      id: string;
      prompt: string;
      negativePrompt?: string;
      aspectRatio?: AspectRatio;
      seed?: number;
    }>;
    provider?: ImageProvider;
  };

  if (!body.images || !Array.isArray(body.images) || body.images.length === 0) {
    return reply.status(400).send({
      success: false,
      error: 'Missing required field: images (non-empty array)'
    });
  }

  // Validate each image has a prompt
  for (const img of body.images) {
    if (!img.prompt || !img.id) {
      return reply.status(400).send({
        success: false,
        error: 'Each image must have id and prompt fields'
      });
    }
  }

  try {
    console.log(`[generate-batch] Generating ${body.images.length} images`);

    const result = await imageGenerator.generateBatch({
      images: body.images,
      provider: body.provider,
    });

    return {
      success: true,
      ...result
    };
  } catch (err: any) {
    console.error('[generate-batch] Error:', err);
    return reply.status(500).send({
      success: false,
      error: err.message || 'Batch generation failed'
    });
  }
});

// Get available image providers info
app.get('/api/image/providers', async () => {
  return {
    success: true,
    providers: imageGenerator.getProviderInfo(),
    defaultProvider: process.env.IMAGE_PROVIDER || 'flux-dev',
  };
});

const start = async () => {
  try {
    await app.listen({ port: 3001 });
    console.log('Server running on http://localhost:3001');
  } catch (err) {
    process.exit(1);
  }
};

start();

