import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { ComicPlanner } from './services/comicPlanner.js';
import { ComicPlanRequest, ComicStyleConfig, ComicStyle, ComicSetting } from '@kitsumy/types';
import fs from 'fs';
import path from 'path';
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

// Generate comic plan with images and save to file
app.post('/api/comic/generate', async (request, reply) => {
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

const start = async () => {
  try {
    await app.listen({ port: 3001 });
    console.log('Server running on http://localhost:3001');
  } catch (err) {
    process.exit(1);
  }
};

start();

