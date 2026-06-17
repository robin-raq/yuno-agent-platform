import Fastify, { type FastifyInstance } from 'fastify';
import type { DB } from './db/db';
import { getDb } from './db/db';
import { makeAgentsRepo } from './db/agents';
import { makeWorkflowsRepo } from './db/workflows';
import { makeRunsRepo } from './db/runs';
import { makeCustomToolsRepo } from './db/custom-tools';
import { makeGooseExecutor } from './runtime/executor';
import { makeRunService } from './services/run-service';
import type { NodeExecutor } from './engine/engine';
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
  const customTools = makeCustomToolsRepo(db);

  const app = Fastify({ logger: false });
  registerHealth(app);
  registerAgents(app, agents);
  registerWorkflows(app, workflows);
  registerRuns(app, runs, runService);
  registerTools(app, customTools);
  registerEvals(app);
  // NB: the MCP tool routes are NOT on this (public) app — they run on a separate loopback-only
  // server (see src/mcp/server.ts, started by main.ts) so callable tools aren't publicly reachable.
  registerWeb(app); // serve the built UI when present (no-op otherwise)
  return app;
}
