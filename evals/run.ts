/**
 * Deterministic eval layer (free — no LLM). Replays every golden scenario through the real
 * engine with scripted agent decisions and reports the headline metrics.
 *   npm run eval:ci
 * The live, real-agent layer (+ LLM-judge) is E2.
 */
import { scenarios } from './scenarios';
import { runMock } from './runner';
import { computeMetrics } from './metrics';
import { toReport, writeReport } from './report';
import type { ScenarioResult } from './types';

const results: ScenarioResult[] = [];
for (const s of scenarios) results.push(await runMock(s));

const m = computeMetrics(results);
// Persist for the Evaluations screen (GET /api/evals). Timestamp here — fine in a plain script.
writeReport(toReport('deterministic', m, results, new Date().toISOString()));

console.log(`\nYuno eval — deterministic engine layer · ${m.total} golden scenarios\n`);
for (const r of results) {
  const line = `  ${r.pass ? 'PASS' : 'FAIL'}  ${r.id}`;
  console.log(r.pass ? line : `${line}  — ${r.failures.join('; ')}`);
}
console.log(`\n  Task completion rate : ${(m.taskCompletionRate * 100).toFixed(1)}%  (${m.passed}/${m.total})`);
console.log(`  A2A reliability      : ${(m.a2aReliability * 100).toFixed(1)}%`);
console.log('  By tag:');
for (const [tag, t] of Object.entries(m.byTag).sort()) {
  console.log(`    ${tag.padEnd(16)} ${t.passed}/${t.total}`);
}

process.exit(m.passed === m.total ? 0 : 1);
