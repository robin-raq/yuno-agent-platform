import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { WorkflowsRepo } from '../db/workflows';

const nodeSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  label: z.string().optional(),
  kind: z.enum(['agent', 'gate']).optional(),
});

const edgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  condition: z.enum(['on_complete', 'on_approve', 'on_reject']),
  label: z.string().optional(),
  maxLoops: z.number().int().positive().optional(),
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  isTemplate: z.boolean().default(false),
  entryNodeId: z.string().min(1),
  nodes: z.array(nodeSchema).min(1),
  edges: z.array(edgeSchema),
});

export function registerWorkflows(app: FastifyInstance, repo: WorkflowsRepo): void {
  app.get('/api/workflows', async () => repo.list());

  app.get('/api/workflows/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const wf = repo.get(id);
    if (!wf) return reply.code(404).send({ error: 'not found' });
    return wf;
  });

  app.post('/api/workflows', async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return reply.code(201).send(repo.create(parsed.data));
  });

  app.delete('/api/workflows/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    return repo.remove(id) ? reply.code(204).send() : reply.code(404).send({ error: 'not found' });
  });
}
