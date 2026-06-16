import type { AgentsRepo } from '../db/agents';
import type { NodeExecutor, Signal } from '../engine/engine';
import { runGooseTask } from './goose';

const DECISION_RE = /DECISION:\s*(complete|approve|reject)/i;

/** Map an agent's free-form reply to an engine signal via the trailing DECISION line. */
export function parseSignal(output: string): Signal {
  const m = output.match(DECISION_RE);
  return (m?.[1]?.toLowerCase() as Signal | undefined) ?? 'complete';
}

/** Strip the DECISION control line from text shown to humans / passed downstream. */
export function stripDecision(output: string): string {
  return output.replace(DECISION_RE, '').trim();
}

/**
 * Rough token estimate (~4 chars/token). Goose's `run --no-session` does not emit
 * usage on stdout, so this is labelled "estimated" in the UI; real usage is a
 * future enhancement via the ACP serve channel.
 */
export function estimateTokens(input: string, output: string): number {
  return Math.ceil((input.length + output.length) / 4);
}

const decisionInstruction =
  'After acting, end your reply with a line exactly in this form: "DECISION: <complete|approve|reject>". ' +
  'Use approve/reject when your role is to gate or review; otherwise use complete.';

/** Production node executor: runs each node's agent through Goose. */
export function makeGooseExecutor(agents: AgentsRepo): NodeExecutor {
  return async ({ node, message }) => {
    const agent = agents.get(node.agentId);
    const systemPrompt = [
      agent?.systemPrompt ?? 'You are a helpful autonomous agent.',
      agent?.tools?.length ? `Available tools: ${agent.tools.join(', ')}.` : '',
      decisionInstruction,
    ]
      .filter(Boolean)
      .join('\n');

    const res = await runGooseTask({ systemPrompt, text: message, model: agent?.model });
    const raw = res.ok ? res.output : res.error ?? 'agent error';
    return {
      signal: parseSignal(raw),
      output: stripDecision(raw) || raw,
      tokens: estimateTokens(message, raw),
    };
  };
}
