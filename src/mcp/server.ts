import Fastify, { type FastifyInstance } from 'fastify';
import type { AgentsRepo } from '../db/agents';
import type { RunsRepo } from '../db/runs';
import type { CustomToolsRepo } from '../db/custom-tools';
import { registerMcpRoutes } from './route';

export interface McpDeps {
  agents: AgentsRepo;
  customTools: CustomToolsRepo;
  runs: RunsRepo;
}

/**
 * The MCP tool server as its OWN Fastify instance, meant to be bound to loopback only
 * (127.0.0.1:config.mcpPort). Keeping it off the public app means the callable tools — including
 * the payout simulator — are never reachable from outside the host, only by the local Goose
 * subprocess. Used by main.ts and by the eval/smoke runners.
 */
export function buildMcpApp(deps: McpDeps): FastifyInstance {
  const app = Fastify({ logger: false });
  registerMcpRoutes(app, deps);
  return app;
}
