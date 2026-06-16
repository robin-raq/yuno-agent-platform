import type { Guardrails } from '../domain/types';

/**
 * Runtime denylist check. Distinct from tool scoping (agent.tools = what the agent can SEE):
 * a tool may be visible yet blocked by policy. Enforced at the MCP call boundary before any
 * handler runs, so a blocked action never executes.
 */
export function isActionBlocked(toolName: string, guardrails?: Guardrails): boolean {
  return Boolean(guardrails?.blockedActions?.includes(toolName));
}
