import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AgentsRepo } from '../db/agents';

const guardrailsSchema = z
  .object({
    maxTokensPerRun: z.number().int().positive(),
    maxCostUsd: z.number().positive(),
    rateLimitPerMin: z.number().int().positive(),
    approvalThresholdUsd: z.number().nonnegative(),
    blockedActions: z.array(z.string()),
  })
  .partial();

const interactionRulesSchema = z
  .object({
    autonomous: z.array(z.string()),
    requiresApproval: z.array(z.string()),
  })
  .partial();

const baseAgent = {
  name: z.string().min(1),
  role: z.string().min(1),
  systemPrompt: z.string().min(1),
  model: z.string().min(1),
  tools: z.array(z.string()).default([]),
  channels: z.array(z.enum(['internal', 'telegram'])).default(['internal']),
  interactionRules: interactionRulesSchema.default({}),
  guardrails: guardrailsSchema.default({}),
};

const createSchema = z.object(baseAgent);
const updateSchema = z.object(baseAgent).partial();

export function registerAgents(app: FastifyInstance, repo: AgentsRepo): void {
  app.get('/api/agents', async () => repo.list());

  app.get('/api/agents/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = repo.get(id);
    if (!agent) return reply.code(404).send({ error: 'not found' });
    return agent;
  });

  app.post('/api/agents', async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return reply.code(201).send(repo.create(parsed.data));
  });

  app.patch('/api/agents/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = repo.update(id, parsed.data);
    if (!updated) return reply.code(404).send({ error: 'not found' });
    return updated;
  });

  app.delete('/api/agents/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    return repo.remove(id) ? reply.code(204).send() : reply.code(404).send({ error: 'not found' });
  });
}
