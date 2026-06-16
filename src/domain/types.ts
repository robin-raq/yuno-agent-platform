/** Core domain types. Mirrors the data model in docs/PRD-expanded.md. */

export type ID = string;
export type ISO = string;

export interface Guardrails {
  maxTokensPerRun: number;
  maxCostUsd: number;
  rateLimitPerMin: number;
  approvalThresholdUsd: number;
  blockedActions: string[];
}

export interface InteractionRules {
  autonomous: string[];
  requiresApproval: string[];
}

export type Channel = 'internal' | 'telegram';

export interface Agent {
  id: ID;
  name: string;
  role: string;
  systemPrompt: string;
  model: string;
  tools: string[];
  channels: Channel[];
  interactionRules: InteractionRules;
  guardrails: Guardrails;
  createdAt: ISO;
  updatedAt: ISO;
}

export type NewAgent = Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>;

/** Patch input: scalar fields and sub-objects may all be partial; the repo merges. */
export type AgentPatch = Partial<Omit<NewAgent, 'guardrails' | 'interactionRules'>> & {
  guardrails?: Partial<Guardrails>;
  interactionRules?: Partial<InteractionRules>;
};

/** Create input: sub-objects may be partial — the repo fills in defaults. */
export interface CreateAgentInput {
  name: string;
  role: string;
  systemPrompt: string;
  model: string;
  tools: string[];
  channels: Channel[];
  interactionRules?: Partial<InteractionRules>;
  guardrails?: Partial<Guardrails>;
}

export const defaultGuardrails = (): Guardrails => ({
  maxTokensPerRun: 20000,
  maxCostUsd: 1.0,
  rateLimitPerMin: 30,
  approvalThresholdUsd: 5000,
  blockedActions: [],
});

export const defaultInteractionRules = (): InteractionRules => ({
  autonomous: [],
  requiresApproval: [],
});
