import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Orchestrator } from './services/orchestrator.js';
import { ComicPlanner } from './services/comicPlanner.js';
import { AppMode, ComicPlanRequest, ComicStyleConfig } from '@kitsumy/types';
import fs from 'fs';
import path from 'path';

const app = Fastify({ logger: false });
const orchestrator = new Orchestrator();
const comicPlanner = new ComicPlanner();

app.register(cors, { origin: '*' });

// Legacy endpoint - generates comic with images
app.post('/generate', async (request, reply) => {
  const body = request.body as any;

  try {
    const result = await orchestrator.dispatch({
      mode: body.mode || AppMode.LEARNING,
      prompt: body.prompt,
      style: body.style,
      maxPages: body.maxPages,
      userContext: body.userContext || {}
    });
    return { success: true, data: result };
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Generation failed' });
  }
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

// Generate comic plan and save to file for later import
app.post('/api/comic/generate-v2', async (request, reply) => {
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
      setting: body.style.setting || 'realistic',
    };

    const planRequest: ComicPlanRequest = {
      prompt: body.prompt,
      style: styleConfig,
      maxPages: body.maxPages,
      language: body.language,
    };

    console.log(`[generate-v2] Creating plan for: "${body.prompt}"`);
    const plan = await comicPlanner.createPlan(planRequest);

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
      charactersCount: plan.characters.length,
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

const start = async () => {
  try {
    await app.listen({ port: 3001 });
    console.log('Server running on http://localhost:3001');
  } catch (err) {
    process.exit(1);
  }
};

start();

