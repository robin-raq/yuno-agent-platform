import type { AgentsRepo } from '../db/agents';
import type { NodeExecutor, Signal } from '../engine/engine';
import { config } from '../config';
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
 * Clamp a parsed signal to the node's routable set — the LLM can't be trusted to stay in-set.
 * Fails safe: prefer `complete`, then the conservative `reject` (so an approval gate fails CLOSED
 * rather than auto-approving), and only fall back to the first allowed signal as a last resort.
 */
export function clampSignal(signal: Signal, allowed: Signal[]): Signal {
  if (allowed.includes(signal)) return signal;
  if (allowed.includes('complete')) return 'complete';
  if (allowed.includes('reject')) return 'reject';
  return allowed[0];
}

/**
 * Fallback token estimate (~4 chars/token), used only when Goose does not return real usage
 * (e.g. a failed run). Successful runs use the real input/output/total counts from
 * `goose run --output-format json`.
 */
export function estimateTokens(input: string, output: string): number {
  return Math.ceil((input.length + output.length) / 4);
}

/**
 * Scoped MCP endpoint Goose connects to for this agent's permitted tools (loopback only).
 * Carries the run id so tool calls can be correlated back to the run trail.
 */
export function toolEndpoint(agentId: string, runId?: string): string {
  const base = `${config.mcpBaseUrl}/mcp/${encodeURIComponent(agentId)}`;
  return runId ? `${base}?runId=${encodeURIComponent(runId)}` : base;
}

/** Production node executor: runs each node's agent through Goose, constrained to routable signals. */
export function makeGooseExecutor(agents: AgentsRepo): NodeExecutor {
  return async ({ node, message, availableSignals, runId }) => {
    const agent = agents.get(node.agentId);
    const allowed: Signal[] = availableSignals.length ? availableSignals : ['complete'];
    const decisionInstruction = `End your reply with a line exactly: "DECISION: <${allowed.join('|')}>". Choose only from those options.`;

    // Tools are discovered by Goose from the scoped MCP server's tools/list — no need to
    // list them in the prompt. Only attach the extension when the agent actually has tools.
    const extensions = agent?.tools?.length ? [toolEndpoint(node.agentId, runId)] : [];

    const systemPrompt = [agent?.systemPrompt ?? 'You are a helpful autonomous agent.', decisionInstruction]
      .filter(Boolean)
      .join('\n');

    const res = await runGooseTask({
      systemPrompt,
      text: message,
      model: agent?.model,
      extensions,
      jsonOutput: true,
    });
    const raw = res.ok ? res.output : res.error ?? 'agent error';

    const signal = clampSignal(parseSignal(raw), allowed);

    const tokens = res.usage?.totalTokens ?? estimateTokens(message, raw);
    return { signal, output: stripDecision(raw) || raw, tokens };
  };
}
