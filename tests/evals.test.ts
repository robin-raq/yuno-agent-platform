import { describe, expect, it } from 'vitest';
import { score } from '../evals/scorer';
import { computeMetrics } from '../evals/metrics';
import { runMock } from '../evals/runner';
import { scenarios } from '../evals/scenarios';
import type { RunOutcome, ScenarioResult } from '../evals/types';

const outcome = (over: Partial<RunOutcome> = {}): RunOutcome => ({
  status: 'completed',
  visitedNodes: ['intake', 'comp', 'fx', 'payout'],
  finalOutput: 'payout simulated',
  handoffs: 3,
  successfulHandoffs: 3,
  ...over,
});

describe('scorer', () => {
  it('passes when routing expectations are met', () => {
    expect(score(outcome(), { terminalStatus: 'completed', reachesNode: 'payout' }).pass).toBe(true);
  });

  it('fails when a forbidden node is reached', () => {
    const r = score(outcome(), { notReachesNode: 'payout' });
    expect(r.pass).toBe(false);
    expect(r.failures[0]).toMatch(/NOT to reach/);
  });

  it('skips tool/output checks when the outcome has no tool data (deterministic layer)', () => {
    // calledTools undefined → live-only checks are skipped, not failed
    expect(score(outcome(), { callsTools: ['initiate_payout'], outputIncludes: ['nope'] }).pass).toBe(true);
  });

  it('applies tool/output checks when tool data is present (live layer)', () => {
    const r = score(outcome({ calledTools: ['screen_sanctions'] }), { callsTools: ['initiate_payout'] });
    expect(r.pass).toBe(false);
  });
});

describe('computeMetrics', () => {
  it('computes completion rate and A2A reliability', () => {
    const results: ScenarioResult[] = [
      { id: 'a', tags: ['cbp'], pass: true, failures: [], outcome: outcome() },
      { id: 'b', tags: ['cbp'], pass: false, failures: ['x'], outcome: outcome({ successfulHandoffs: 2 }) },
    ];
    const m = computeMetrics(results);
    expect(m.taskCompletionRate).toBe(0.5);
    expect(m.a2aReliability).toBeCloseTo(5 / 6); // (3+2)/(3+3)
    expect(m.byTag.cbp).toEqual({ total: 2, passed: 1 });
  });
});

describe('golden scenarios (deterministic layer)', () => {
  it('has at least 30 scenarios', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(30);
  });

  it('every scenario passes its own deterministic expectations', async () => {
    const results = await Promise.all(scenarios.map(runMock));
    const failed = results.filter((r) => !r.pass);
    expect(failed.map((f) => `${f.id}: ${f.failures.join(', ')}`)).toEqual([]);
  });
});
