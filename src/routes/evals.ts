import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';

const RESULTS = resolve('data/eval-results.json');

/**
 * Serve the latest eval report (written by `npm run eval:ci` / `npm run eval`) for the
 * Evaluations screen. Reads the JSON file directly so src/ stays independent of evals/.
 */
export function registerEvals(app: FastifyInstance): void {
  app.get('/api/evals', async () => {
    if (!existsSync(RESULTS)) return { empty: true };
    try {
      return JSON.parse(readFileSync(RESULTS, 'utf8'));
    } catch {
      return { empty: true };
    }
  });
}
