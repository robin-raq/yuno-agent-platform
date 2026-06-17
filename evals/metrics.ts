import type { ScenarioResult } from './types';

export interface EvalMetrics {
  total: number;
  passed: number;
  /** Two of the PRD's Key Impact Metrics. */
  taskCompletionRate: number; // share of scenarios meeting their expectations
  a2aReliability: number; // share of agent handoffs that delivered to a downstream step
  byTag: Record<string, { total: number; passed: number }>;
}

const pct = (n: number, d: number) => (d === 0 ? 1 : n / d);

/** Aggregate scenario results into the headline eval metrics. */
export function computeMetrics(results: ScenarioResult[]): EvalMetrics {
  const passed = results.filter((r) => r.pass).length;
  const handoffs = results.reduce((s, r) => s + r.outcome.handoffs, 0);
  const okHandoffs = results.reduce((s, r) => s + r.outcome.successfulHandoffs, 0);

  const byTag: Record<string, { total: number; passed: number }> = {};
  for (const r of results) {
    for (const tag of r.tags) {
      const t = (byTag[tag] ??= { total: 0, passed: 0 });
      t.total += 1;
      if (r.pass) t.passed += 1;
    }
  }

  return {
    total: results.length,
    passed,
    taskCompletionRate: pct(passed, results.length),
    a2aReliability: pct(okHandoffs, handoffs),
    byTag,
  };
}
