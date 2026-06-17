/** Shapes mirrored from the backend API (src/domain, src/db). Kept minimal — only what the UI reads. */

/** UI navigation routes (sidebar) + a navigate helper threaded to screens. */
export type Route =
  | 'dashboard'
  | 'agents'
  | 'editor'
  | 'workflows'
  | 'builder'
  | 'runs'
  | 'channels'
  | 'evals';
export type Nav = (route: Route, runId?: string) => void;

export interface Health {
  ok: boolean;
  name: string;
  capabilities: { goose: boolean; telegram: boolean; payments: boolean };
}

export interface Guardrails {
  maxTokensPerRun: number;
  maxCostUsd: number;
  rateLimitPerMin: number;
  approvalThresholdUsd: number;
  blockedActions: string[];
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  model: string;
  tools: string[];
  channels: string[];
  guardrails: Guardrails;
}

/** Editable fields the Agent Editor submits (create or patch). The repo fills defaults. */
export interface AgentInput {
  name: string;
  role: string;
  systemPrompt: string;
  model: string;
  tools: string[];
  channels: string[];
  guardrails: { approvalThresholdUsd: number; maxTokensPerRun: number; blockedActions: string[] };
}

export interface Run {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'awaiting_approval';
  totalTokens: number;
  startedAt: string;
  finishedAt?: string;
}

export interface EventLog {
  id: string;
  runId?: string;
  level: 'info' | 'ok' | 'warn' | 'error';
  type: string;
  message: string;
  createdAt: string;
}

export interface Tool {
  name: string;
  description: string;
  params: string[];
}

export interface WorkflowNode {
  id: string;
  agentId: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  isTemplate: boolean;
  entryNodeId: string;
  nodes: WorkflowNode[];
  edges: { from: string; to: string; condition: string; maxLoops?: number }[];
}

export interface RunStep {
  id: string;
  runId: string;
  nodeId: string;
  agentId: string;
  status: string;
  input: string;
  output: string;
  signal?: string;
  tokens: number;
  startedAt: string;
  finishedAt?: string;
}

export interface Message {
  id: string;
  runId?: string;
  fromAgentId?: string;
  toAgentId?: string;
  channel: string;
  direction: string;
  content: string;
  createdAt: string;
}

export interface RunDetail extends Run {
  steps: RunStep[];
  messages: Message[];
  events: EventLog[];
}

export interface EvalReport {
  empty?: boolean;
  generatedAt: string;
  layer: 'deterministic' | 'live';
  metrics: {
    total: number;
    passed: number;
    taskCompletionRate: number;
    a2aReliability: number;
    byTag: Record<string, { total: number; passed: number }>;
  };
  scenarios: Array<{ id: string; tags: string[]; pass: boolean; failures: string[]; reason?: string }>;
}
