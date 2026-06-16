import type { ZodRawShape } from 'zod';

/** Context handed to every tool call — lets a handler know who is calling and for which run. */
export interface ToolContext {
  agentId: string;
  runId?: string;
}

/**
 * A platform-owned tool. The handler returns plain JSON-able data; the MCP layer wraps it
 * as protocol content. Keeping handlers free of MCP envelopes makes them unit-testable as
 * pure functions.
 */
export interface ToolDef {
  name: string;
  description: string;
  /** Zod raw shape (`{}` for no args) — surfaced to the model as the tool's input schema. */
  inputSchema: ZodRawShape;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => unknown | Promise<unknown>;
}

/**
 * Registry of available tools. A factory (not a global) so the server and tests each build
 * their own — consistent with the repository factories elsewhere in the codebase.
 */
export function makeToolRegistry(defs: ToolDef[]) {
  const byName = new Map(defs.map((d) => [d.name, d]));
  return {
    all: (): ToolDef[] => [...byName.values()],
    get: (name: string): ToolDef | null => byName.get(name) ?? null,
    /** The subset an agent is permitted to call — unknown names are dropped (least privilege). */
    forAgent: (allowed: string[]): ToolDef[] =>
      allowed.map((n) => byName.get(n)).filter((d): d is ToolDef => Boolean(d)),
  };
}

export type ToolRegistry = ReturnType<typeof makeToolRegistry>;
