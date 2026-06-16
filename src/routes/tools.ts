import type { FastifyInstance } from 'fastify';
import type { ToolRegistry } from '../tools';

/**
 * Read-only tool catalog for the Workflow Builder UI. Exposes tool metadata (name, description,
 * parameter names) — never the handlers. This is the "tools are platform data" surface that lets
 * the UI list what an agent can be granted.
 */
export function registerTools(app: FastifyInstance, registry: ToolRegistry): void {
  app.get('/api/tools', async () =>
    registry.all().map((t) => ({
      name: t.name,
      description: t.description,
      params: Object.keys(t.inputSchema),
    })),
  );
}
