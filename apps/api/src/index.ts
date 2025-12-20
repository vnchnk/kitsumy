import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Orchestrator } from './services/orchestrator.js';
import { ComicPlanner } from './services/comicPlanner.js';
import { AppMode, ComicPlanRequest, ComicStyleConfig } from '@kitsumy/types';

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

const start = async () => {
  try {
    await app.listen({ port: 3001 });
    console.log('Server running on http://localhost:3001');
  } catch (err) {
    process.exit(1);
  }
};

start();

