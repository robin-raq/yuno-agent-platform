import type { Channel, ID, ISO } from './types';

/** A transition fires when the source node emits the matching signal. */
export type EdgeCondition = 'on_complete' | 'on_approve' | 'on_reject';
export type NodeKind = 'agent' | 'gate';

export interface WorkflowNode {
  id: string;
  agentId: ID;
  label?: string;
  kind?: NodeKind;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  condition: EdgeCondition;
  label?: string;
  /** Cap on how many times this edge may fire in one run (feedback-loop safety). */
  maxLoops?: number;
}

export interface Workflow {
  id: ID;
  name: string;
  description: string;
  isTemplate: boolean;
  /** Explicit start node — required because a feedback edge can give every node an incoming edge. */
  entryNodeId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: ISO;
  updatedAt: ISO;
}

export type NewWorkflow = Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>;

export type RunStatus = 'pending' | 'running' | 'awaiting_approval' | 'completed' | 'failed';
export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'blocked';

export interface Run {
  id: ID;
  workflowId: ID;
  status: RunStatus;
  totalTokens: number;
  startedAt: ISO;
  finishedAt?: ISO;
}

export interface RunStep {
  id: ID;
  runId: ID;
  nodeId: string;
  agentId: ID;
  status: StepStatus;
  input: string;
  output: string;
  signal?: string;
  tokens: number;
  startedAt: ISO;
  finishedAt?: ISO;
}

export type EventLevel = 'info' | 'ok' | 'warn' | 'error' | 'tool';

/** Human-readable monitoring feed entry. */
export interface EventLog {
  id: ID;
  runId?: ID;
  level: EventLevel;
  type: string;
  message: string;
  createdAt: ISO;
}

export type MessageDirection = 'in' | 'out' | 'a2a';

/** The persisted conversation trail — both inter-agent (a2a) and external-channel messages. */
export interface Message {
  id: ID;
  runId?: ID;
  fromAgentId?: ID;
  toAgentId?: ID;
  channel: Channel;
  direction: MessageDirection;
  content: string;
  createdAt: ISO;
}
