import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { RunsRepo } from '../db/runs';
import type { RunService } from '../services/run-service';

const startSchema = z.object({
  workflowId: z.string().min(1),
  message: z.string().min(1),
});

export function registerRuns(app: FastifyInstance, runs: RunsRepo, runService: RunService): void {
  app.get('/api/runs', async () => runs.listRuns());

  app.get('/api/runs/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const run = runs.getRun(id);
    if (!run) return reply.code(404).send({ error: 'not found' });
    return {
      ...run,
      steps: runs.listSteps(id),
      messages: runs.listMessages(id),
      events: runs.listEvents(id),
    };
  });

  app.post('/api/runs', async (req, reply) => {
    const parsed = startSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const run = await runService.startRun(parsed.data.workflowId, parsed.data.message);
    if (!run) return reply.code(404).send({ error: 'workflow not found' });
    return reply.code(201).send(run);
  });

  // Monitoring feeds (consumed by the dashboard + channels view).
  app.get('/api/events', async () => runs.recentEvents());
  app.get('/api/messages', async () => runs.recentMessages());
}
