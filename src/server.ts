import Fastify, { type FastifyInstance } from 'fastify';
import type { DB } from './db/db';
import { getDb } from './db/db';
import { makeAgentsRepo } from './db/agents';
import { registerHealth } from './routes/health';
import { registerAgents } from './routes/agents';

/** Build the Fastify app. Accepts a DB so tests can pass an in-memory database. */
export function buildServer(db: DB = getDb()): FastifyInstance {
  const app = Fastify({ logger: false });
  registerHealth(app);
  registerAgents(app, makeAgentsRepo(db));
  return app;
}
