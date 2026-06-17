/**
 * Eval runner.
 *   npm run eval:ci             deterministic layer — replay all scenarios via a scripted
 *                               executor through the real engine (free, no LLM).
 *   npm run eval -- --live      live layer — real Goose + LLM-judge (costs tokens).
 *     [--tags=cbp,sanctions]    run only scenarios with any of these tags
 *     [--trials=2]              repeat each scenario N times; pass = majority of trials
 * Both write data/eval-results.json, which the Evaluations screen reads.
 */
import { scenarios } from './scenarios';
import { runMock } from './runner';
import { computeMetrics } from './metrics';
import { toReport, writeReport } from './report';
import type { ScenarioResult } from './types';

const live = process.argv.includes('--live');
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];

const results: ScenarioResult[] = [];
if (live) {
  const { runLiveSuite } = await import('./live-runner');
  results.push(...(await runLiveSuite(scenarios, { tags: arg('tags')?.split(','), trials: arg('trials') ? Number(arg('trials')) : 1 })));
} else {
  for (const s of scenarios) results.push(await runMock(s));
}

const m = computeMetrics(results);
writeReport(toReport(live ? 'live' : 'deterministic', m, results, new Date().toISOString()));

console.log(`\nYuno eval — ${live ? 'LIVE (real Goose + LLM-judge)' : 'deterministic engine'} layer · ${m.total} scenarios\n`);
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
