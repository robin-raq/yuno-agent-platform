import type { Expect, RunOutcome } from './types';

/**
 * Deterministic scorer: check a run outcome against a scenario's expectations.
 * Checks that need data the outcome doesn't carry (e.g. tool calls in the deterministic
 * layer, where `calledTools` is undefined) are skipped rather than failed.
 */
export function score(outcome: RunOutcome, expect: Expect): { pass: boolean; failures: string[] } {
  const failures: string[] = [];

  if (expect.terminalStatus && outcome.status !== expect.terminalStatus) {
    failures.push(`status: expected ${expect.terminalStatus}, got ${outcome.status}`);
  }
  if (expect.reachesNode && !outcome.visitedNodes.includes(expect.reachesNode)) {
    failures.push(`expected to reach node "${expect.reachesNode}"`);
  }
  if (expect.notReachesNode && outcome.visitedNodes.includes(expect.notReachesNode)) {
    failures.push(`expected NOT to reach node "${expect.notReachesNode}"`);
  }
  if (expect.callsTools && outcome.calledTools) {
    for (const tool of expect.callsTools) {
      if (!outcome.calledTools.includes(tool)) failures.push(`expected tool call "${tool}"`);
    }
  }
  if (expect.outputIncludes && outcome.calledTools) {
    const hay = outcome.finalOutput.toLowerCase();
    for (const needle of expect.outputIncludes) {
      if (!hay.includes(needle.toLowerCase())) failures.push(`output missing "${needle}"`);
    }
  }

  return { pass: failures.length === 0, failures };
}
