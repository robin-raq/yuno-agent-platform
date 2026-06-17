import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { score } from '../evals/scorer';
import { computeMetrics } from '../evals/metrics';
import { runMock } from '../evals/runner';
import { scenarios } from '../evals/scenarios';
import { readReport, toReport, writeReport } from '../evals/report';
import { parseVerdict } from '../evals/judge';
import { toolNameFromEvent } from '../evals/live-runner';
import { createDb } from '../src/db/db';
import { buildServer } from '../src/server';
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

describe('report persistence', () => {
  it('round-trips a report to disk', () => {
    const path = join(tmpdir(), `yuno-eval-${Date.now()}.json`);
    const results: ScenarioResult[] = [
      { id: 'a', tags: ['cbp'], pass: true, failures: [], outcome: { status: 'completed', visitedNodes: [], finalOutput: '', handoffs: 0, successfulHandoffs: 0 } },
    ];
    const report = toReport('deterministic', computeMetrics(results), results, '2026-06-16T00:00:00.000Z');
    writeReport(report, path);
    expect(readReport(path)).toEqual(report);
  });

  it('returns null for a missing report', () => {
    expect(readReport(join(tmpdir(), 'does-not-exist-eval.json'))).toBeNull();
  });
});

describe('judge.parseVerdict (live layer)', () => {
  it('reads pass/fail and keeps the reason', () => {
    expect(parseVerdict('Looks correct.\nVERDICT: pass')).toEqual({ pass: true, reason: 'Looks correct.' });
    expect(parseVerdict('Missing screening.\nVERDICT: FAIL').pass).toBe(false);
  });
  it('defaults to fail when no verdict line is present', () => {
    expect(parseVerdict('rambling with no verdict').pass).toBe(false);
  });
});

describe('toolNameFromEvent (live layer)', () => {
  it('extracts the tool name from a tool_call event message', () => {
    expect(toolNameFromEvent('screen_sanctions → {"status":"cleared"}')).toBe('screen_sanctions');
    expect(toolNameFromEvent('no arrow here')).toBeUndefined();
  });
});

describe('GET /api/evals', () => {
  it('returns a JSON object (report or empty marker)', async () => {
    const app = buildServer(createDb(':memory:'));
    const res = await app.inject({ method: 'GET', url: '/api/evals' });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json()).toBe('object');
    await app.close();
  });
});
