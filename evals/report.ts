import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { EvalMetrics } from './metrics';
import type { ScenarioResult } from './types';

const RESULTS_PATH = 'data/eval-results.json';

/** Persisted eval results — written by `npm run eval(:ci)`, read by GET /api/evals for the UI. */
export interface EvalReport {
  generatedAt: string;
  layer: 'deterministic' | 'live';
  metrics: EvalMetrics;
  scenarios: Array<{ id: string; tags: string[]; pass: boolean; failures: string[]; reason?: string }>;
}

export function toReport(layer: EvalReport['layer'], metrics: EvalMetrics, results: ScenarioResult[], generatedAt: string): EvalReport {
  return {
    generatedAt,
    layer,
    metrics,
    scenarios: results.map((r) => ({ id: r.id, tags: r.tags, pass: r.pass, failures: r.failures, reason: r.verdict?.reason })),
  };
}

export function writeReport(report: EvalReport, path = RESULTS_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(report, null, 2));
}

export function readReport(path = RESULTS_PATH): EvalReport | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as EvalReport;
  } catch {
    return null;
  }
}
