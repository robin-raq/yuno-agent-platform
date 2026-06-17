import { createDb } from '../src/db/db';
import { makeWorkflowsRepo } from '../src/db/workflows';
import { seedTemplates } from '../src/db/seed';
import { executeWorkflow } from '../src/engine/engine';
import { makeScriptedExecutor } from './scripted';
import { score } from './scorer';
import type { RunOutcome, Scenario, ScenarioResult } from './types';

const emptyOutcome = (): RunOutcome => ({
  status: 'failed',
  visitedNodes: [],
  finalOutput: '',
  handoffs: 0,
  successfulHandoffs: 0,
});

/**
 * Deterministic layer: replay a scenario through the REAL engine with a scripted executor,
 * then score the outcome. Free (no LLM), so it runs the full golden set every time.
 */
export async function runMock(scenario: Scenario): Promise<ScenarioResult> {
  const db = createDb(':memory:');
  seedTemplates(db);
  const wf = makeWorkflowsRepo(db).get(scenario.workflowId);
  if (!wf) {
    return {
      id: scenario.id,
      tags: scenario.tags,
      pass: false,
      failures: [`unknown workflow "${scenario.workflowId}"`],
      outcome: emptyOutcome(),
    };
  }

  const result = await executeWorkflow(wf, scenario.message, makeScriptedExecutor(scenario.script));
  const handoffs = Math.max(0, result.steps.length - 1);
  const outcome: RunOutcome = {
    status: result.status,
    visitedNodes: result.steps.map((s) => s.nodeId),
    finalOutput: result.steps.at(-1)?.output ?? '',
    handoffs,
    successfulHandoffs: handoffs, // every scripted handoff delivers; live measures the real rate
  };

  const { pass, failures } = score(outcome, scenario.expect);
  return { id: scenario.id, tags: scenario.tags, pass, failures, outcome };
}
