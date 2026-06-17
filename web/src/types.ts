/** Shapes mirrored from the backend API (src/domain, src/db). Kept minimal — only what the UI reads. */

export interface Health {
  ok: boolean;
  name: string;
  capabilities: { goose: boolean; telegram: boolean; payments: boolean };
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  model: string;
  tools: string[];
  channels: string[];
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
