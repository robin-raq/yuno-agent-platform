import type { EngineStatus, Signal } from '../src/engine/engine';

/** Assertions a scenario makes about a run's outcome. Routing checks apply to both layers;
 *  tool/output checks are skipped when the outcome doesn't carry that data (deterministic layer). */
export interface Expect {
  terminalStatus?: EngineStatus; // 'completed' | 'failed'
  reachesNode?: string;
  notReachesNode?: string;
  callsTools?: string[]; // live layer only (from tool_call events)
  outputIncludes?: string[]; // substring(s) expected somewhere in step outputs
  judge?: string; // rubric for the LLM-judge (live layer, E2)
}

/**
 * A golden scenario. `script` drives the deterministic layer (scripted agent decisions);
 * `message` drives the live layer (real agents parse it). Both score against `expect`.
 */
export interface Scenario {
  id: string;
  tags: string[];
  workflowId: string;
  message: string;
  /** Per-node signal for the scripted executor. A string array indexes by that node's visit count. */
  script: Record<string, Signal | Signal[]>;
  expect: Expect;
}

/** Normalized result of replaying a scenario, produced by either layer's runner. */
export interface RunOutcome {
  status: EngineStatus;
  visitedNodes: string[];
  finalOutput: string;
  /** Tools observed (live layer); undefined in the deterministic layer so tool checks are skipped. */
  calledTools?: string[];
  /** Count of agent handoffs that delivered input to a downstream step (for A2A reliability). */
  handoffs: number;
  successfulHandoffs: number;
}

export interface Verdict {
  pass: boolean;
  reason: string;
}

export interface ScenarioResult {
  id: string;
  tags: string[];
  pass: boolean;
  failures: string[];
  outcome: RunOutcome;
  /** LLM-judge verdict (live layer only). */
  verdict?: Verdict;
}
