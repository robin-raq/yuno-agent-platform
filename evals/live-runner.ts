import { createDb } from '../src/db/db';
import { makeAgentsRepo } from '../src/db/agents';
import { makeWorkflowsRepo } from '../src/db/workflows';
import { makeRunsRepo, type RunsRepo } from '../src/db/runs';
import { makeCustomToolsRepo } from '../src/db/custom-tools';
import { seedTemplates } from '../src/db/seed';
import { buildMcpApp } from '../src/mcp/server';
import { makeGooseExecutor } from '../src/runtime/executor';
import { makeRunService, type RunService } from '../src/services/run-service';
import { config } from '../src/config';
import { score } from './scorer';
import { judge } from './judge';
import type { RunOutcome, Scenario, ScenarioResult } from './types';

/** Parse the tool name out of a `tool_call` event message ("screen_sanctions → {...}"). */
export const toolNameFromEvent = (message: string): string | undefined => message.match(/^(\w+)\s*→/)?.[1];

export interface LiveOptions {
  trials?: number;
  tags?: string[];
}

const emptyOutcome = (): RunOutcome => ({ status: 'failed', visitedNodes: [], finalOutput: '', calledTools: [], handoffs: 0, successfulHandoffs: 0 });

/**
 * Live layer: replay scenarios through REAL Goose, scoring each with the deterministic checks
 * plus the LLM-judge. Costs tokens — run on demand via `npm run eval`. Multiple trials surface
 * agent nondeterminism; a scenario passes if the majority of its trials pass.
 */
export async function runLiveSuite(scenarios: Scenario[], opts: LiveOptions = {}): Promise<ScenarioResult[]> {
  const trials = Math.max(1, opts.trials ?? 1);
  const selected = opts.tags?.length ? scenarios.filter((s) => s.tags.some((t) => opts.tags!.includes(t))) : scenarios;

  const db = createDb(':memory:');
  seedTemplates(db);
  const agents = makeAgentsRepo(db);
  const runs = makeRunsRepo(db);
  const app = buildMcpApp({ agents, customTools: makeCustomToolsRepo(db), runs });
  await app.listen({ port: config.mcpPort, host: '127.0.0.1' });
  const service = makeRunService({ workflows: makeWorkflowsRepo(db), runs, executor: makeGooseExecutor(agents) });

  const results: ScenarioResult[] = [];
  try {
    for (const scenario of selected) {
      const trialResults: ScenarioResult[] = [];
      for (let t = 0; t < trials; t++) trialResults.push(await runOne(scenario, service, runs));
      const passes = trialResults.filter((r) => r.pass).length;
      const last = trialResults[trialResults.length - 1];
      results.push({
        ...last,
        pass: passes > trials / 2,
        failures: trials > 1 ? [`${passes}/${trials} trials passed`, ...last.failures] : last.failures,
      });
    }
  } finally {
    await app.close();
  }
  return results;
}

async function runOne(s: Scenario, service: RunService, runs: RunsRepo): Promise<ScenarioResult> {
  const run = await service.startRun(s.workflowId, s.message);
  if (!run) return { id: s.id, tags: s.tags, pass: false, failures: ['run failed to start'], outcome: emptyOutcome() };

  const steps = runs.listSteps(run.id);
  const calledTools = [
    ...new Set(
      runs.listEvents(run.id)
        .filter((e) => e.type === 'tool_call')
        .map((e) => toolNameFromEvent(e.message))
        .filter((n): n is string => Boolean(n)),
    ),
  ];
  const outcome: RunOutcome = {
    status: run.status === 'completed' ? 'completed' : 'failed',
    visitedNodes: steps.map((st) => st.nodeId),
    finalOutput: steps.at(-1)?.output ?? '',
    calledTools,
    handoffs: Math.max(0, steps.length - 1),
    successfulHandoffs: steps.filter((st, i) => i > 0 && st.output.length > 0).length,
  };

  const det = score(outcome, s.expect);
  const verdict = s.expect.judge
    ? await judge(s.expect.judge, steps.map((st) => `${st.nodeId}: ${st.output}`).join('\n\n'))
    : undefined;

  const pass = det.pass && (verdict ? verdict.pass : true);
  const failures = [...det.failures, ...(verdict && !verdict.pass ? [`judge: ${verdict.reason}`] : [])];
  return { id: s.id, tags: s.tags, pass, failures, outcome, verdict };
}
