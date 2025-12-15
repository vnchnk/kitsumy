import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Orchestrator } from './services/orchestrator.js';
import { AppMode } from '@kitsumy/types';

const app = Fastify({ logger: true });
const orchestrator = new Orchestrator();

app.register(cors, { origin: '*' });

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

const start = async () => {
  try {
    await app.listen({ port: 3001 });
    console.log('Server running on http://localhost:3001');
  } catch (err) {
    process.exit(1);
  }
};

start();

