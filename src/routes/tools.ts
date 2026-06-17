import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CustomToolsRepo } from '../db/custom-tools';
import { defaultTools } from '../tools';

const TOOL_NAME = /^[a-z][a-z0-9_]*$/;

const createSchema = z.object({
  name: z.string().regex(TOOL_NAME, 'lowercase letters, digits, underscores; must start with a letter'),
  description: z.string().min(1),
  params: z.array(z.string().regex(TOOL_NAME)).default([]),
  response: z.string().default('{}'),
});

/**
 * Tool catalog + custom-tool management. GET lists built-in and user-defined tools (so the
 * Agent Editor can offer both). POST adds a custom tool; DELETE removes one. Built-ins are
 * read-only; custom tools live in the DB and extend the registry at runtime.
 */
export function registerTools(app: FastifyInstance, customTools: CustomToolsRepo): void {
  app.get('/api/tools', async () => {
    const builtIn = defaultTools().map((t) => ({
      name: t.name,
      description: t.description,
      params: Object.keys(t.inputSchema),
      custom: false,
    }));
    const custom = customTools.list().map((t) => ({
      name: t.name,
      description: t.description,
      params: t.params,
      custom: true,
    }));
    return [...builtIn, ...custom];
  });

  app.post('/api/tools', async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const taken = new Set([...defaultTools().map((t) => t.name), ...customTools.list().map((t) => t.name)]);
    if (taken.has(parsed.data.name)) return reply.code(409).send({ error: `tool "${parsed.data.name}" already exists` });
    return reply.code(201).send(customTools.create(parsed.data));
  });

  app.delete('/api/tools/:name', async (req, reply) => {
    const { name } = req.params as { name: string };
    return customTools.remove(name) ? reply.code(204).send() : reply.code(404).send({ error: 'not a custom tool' });
  });
}
