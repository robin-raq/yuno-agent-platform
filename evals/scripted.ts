import type { NodeExecutor, Signal } from '../src/engine/engine';
import type { Scenario } from './types';

/**
 * Deterministic executor for the engine-eval layer: replays a scenario's scripted per-node
 * signals (a string array indexes by that node's visit count, so feedback loops can recover).
 * No LLM, no tools — it exercises engine routing, loop caps, and the scorer/metrics for free.
 */
export function makeScriptedExecutor(script: Scenario['script']): NodeExecutor {
  const visits = new Map<string, number>();
  return async ({ node }) => {
    const v = visits.get(node.id) ?? 0;
    visits.set(node.id, v + 1);
    const scripted = script[node.id];
    const signal: Signal = Array.isArray(scripted)
      ? scripted[Math.min(v, scripted.length - 1)]
      : scripted ?? 'complete';
    return { signal, output: `${node.id}:${signal}`, tokens: 0 };
  };
}
