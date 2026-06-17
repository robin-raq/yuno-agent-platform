import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';

/**
 * Serve the built web UI (web/dist) with SPA fallback. No-op when the UI hasn't been built
 * (tests, API-only runs), so the server still boots. API/MCP paths keep returning JSON 404s.
 */
export function registerWeb(app: FastifyInstance): void {
  const root = resolve('web/dist');
  if (!existsSync(root)) return;

  app.register(fastifyStatic, { root, prefix: '/' });
  app.setNotFoundHandler((req, reply) => {
    if (req.method !== 'GET' || req.url.startsWith('/api') || req.url.startsWith('/mcp')) {
      return reply.code(404).send({ error: 'not found' });
    }
    return reply.sendFile('index.html'); // hand client-side routes back to the SPA
  });
}
