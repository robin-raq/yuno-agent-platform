import Fastify, { type FastifyInstance } from 'fastify';
import type { DB } from './db/db';
import { getDb } from './db/db';
import { makeAgentsRepo } from './db/agents';
import { makeWorkflowsRepo } from './db/workflows';
import { makeRunsRepo } from './db/runs';
import { makeGooseExecutor } from './runtime/executor';
import { makeRunService } from './services/run-service';
import type { NodeExecutor } from './engine/engine';
import { makeDefaultRegistry } from './tools';
import { registerMcpRoutes } from './mcp/route';
import { registerHealth } from './routes/health';
import { registerAgents } from './routes/agents';
import { registerWorkflows } from './routes/workflows';
import { registerRuns } from './routes/runs';
import { registerTools } from './routes/tools';
import { registerEvals } from './routes/evals';
import { registerWeb } from './routes/web';

export interface ServerDeps {
  /** Inject a fake executor in tests; defaults to the real Goose-backed one. */
  executor?: NodeExecutor;
}

/** Build the Fastify app. Accepts a DB (tests pass `:memory:`) and optional deps. */
export function buildServer(db: DB = getDb(), deps: ServerDeps = {}): FastifyInstance {
  const agents = makeAgentsRepo(db);
  const workflows = makeWorkflowsRepo(db);
  const runs = makeRunsRepo(db);
  const executor = deps.executor ?? makeGooseExecutor(agents);
  const runService = makeRunService({ workflows, runs, executor });
  const registry = makeDefaultRegistry();

  const app = Fastify({ logger: false });
  registerHealth(app);
  registerAgents(app, agents);
  registerWorkflows(app, workflows);
  registerRuns(app, runs, runService);
  registerTools(app, registry);
  registerEvals(app);
  registerMcpRoutes(app, { agents, registry, runs });
  registerWeb(app); // serve the built UI when present (no-op otherwise)
  return app;
}
