import type { FastifyInstance } from 'fastify';
import { hasGoose, hasPayments, hasTelegram } from '../config';

/** Health + capability report. The UI uses the flags to show what's wired. */
export function registerHealth(app: FastifyInstance): void {
  app.get('/api/health', async () => ({
    ok: true,
    name: 'yuno-agent-platform',
    capabilities: {
      goose: hasGoose(),
      telegram: hasTelegram(),
      payments: hasPayments(),
    },
  }));
}
