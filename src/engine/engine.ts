import type { EdgeCondition, Workflow, WorkflowNode } from '../domain/workflow';

/** What a node produces when executed — drives which edge fires next. */
export type Signal = 'complete' | 'approve' | 'reject';

export interface StepOutcome {
  signal: Signal;
  output: string;
  tokens: number;
}

export interface ExecInput {
  node: WorkflowNode;
  message: string;
  /** 0-based count of nodes executed so far — lets a fake/real executor vary by visit. */
  visitIndex: number;
  /** Signals that are actually routable from this node — the executor constrains the LLM to these. */
  availableSignals: Signal[];
  /** The owning run id, threaded through so tool calls can be correlated back to the run. */
  runId?: string;
}

/** The runtime boundary: turn a node + inbound message into an outcome. Injected (Goose in prod, fake in tests). */
export type NodeExecutor = (input: ExecInput) => Promise<StepOutcome>;

export interface StepRecord {
  nodeId: string;
  agentId: string;
  input: string;
  output: string;
  signal: Signal;
  tokens: number;
}

export type EngineStatus = 'completed' | 'failed';

export type EngineEvent =
  | { type: 'step_start'; nodeId: string; agentId: string; input: string }
  | { type: 'step_done'; nodeId: string; agentId: string; signal: Signal; output: string; tokens: number }
  | { type: 'message'; fromNodeId: string; toNodeId: string; fromAgentId: string; toAgentId: string; content: string }
  | { type: 'loop_capped'; from: string; to: string; condition: EdgeCondition; limit: number }
  | { type: 'no_outgoing_edge'; nodeId: string; signal: Signal }
  | { type: 'run_done'; status: EngineStatus; reason?: string };

export interface EngineOptions {
  emit?: (event: EngineEvent) => void;
  /** Default per-edge firing cap when an edge does not set its own. */
  defaultMaxLoops?: number;
  /** Hard backstop on total node executions. */
  stepBudget?: number;
  /** Owning run id — passed through to each executor call for tool-call correlation. */
  runId?: string;
}

export interface RunResult {
  status: EngineStatus;
  steps: StepRecord[];
  totalTokens: number;
  reason?: string;
}

const conditionFor = (s: Signal): EdgeCondition =>
  s === 'approve' ? 'on_approve' : s === 'reject' ? 'on_reject' : 'on_complete';

const SIGNAL_BY_CONDITION: Record<EdgeCondition, Signal> = {
  on_complete: 'complete',
  on_approve: 'approve',
  on_reject: 'reject',
};

/** Signals that can actually route out of a node, derived from its outgoing edges. */
export function signalsFor(wf: Workflow, nodeId: string): Signal[] {
  const conditions = new Set(wf.edges.filter((e) => e.from === nodeId).map((e) => e.condition));
  return [...conditions].map((c) => SIGNAL_BY_CONDITION[c]);
}

/** Resolve the start node — prefer the explicit entry, then a node with no incoming edge, then the first. */
export function findEntryNode(wf: Workflow): WorkflowNode | undefined {
  const explicit = wf.nodes.find((n) => n.id === wf.entryNodeId);
  if (explicit) return explicit;
  const hasIncoming = new Set(wf.edges.map((e) => e.to));
  return wf.nodes.find((n) => !hasIncoming.has(n.id)) ?? wf.nodes[0];
}

/**
 * Execute a workflow graph: run a node, read its signal, follow the matching edge,
 * passing each node's output as the next node's input. Feedback edges are capped so
 * a reject→retry cycle cannot run forever; a node with no matching outgoing edge ends the run.
 */
export async function executeWorkflow(
  wf: Workflow,
  initialMessage: string,
  exec: NodeExecutor,
  opts: EngineOptions = {},
): Promise<RunResult> {
  const emit = opts.emit ?? (() => undefined);
  const defaultMaxLoops = opts.defaultMaxLoops ?? 3;
  const stepBudget = opts.stepBudget ?? 50;

  const steps: StepRecord[] = [];
  const loopCounts = new Map<string, number>();
  let totalTokens = 0;

  const finish = (status: EngineStatus, reason?: string): RunResult => {
    emit({ type: 'run_done', status, reason });
    return { status, steps, totalTokens, reason };
  };

  let current = findEntryNode(wf);
  if (!current) return finish('failed', 'empty workflow');
  let message = initialMessage;
  let visitIndex = 0;

  while (current) {
    if (steps.length >= stepBudget) return finish('failed', 'step budget exceeded');

    emit({ type: 'step_start', nodeId: current.id, agentId: current.agentId, input: message });
    const outcome = await exec({
      node: current,
      message,
      visitIndex: visitIndex++,
      availableSignals: signalsFor(wf, current.id),
      runId: opts.runId,
    });
    totalTokens += outcome.tokens;
    steps.push({
      nodeId: current.id,
      agentId: current.agentId,
      input: message,
      output: outcome.output,
      signal: outcome.signal,
      tokens: outcome.tokens,
    });
    emit({
      type: 'step_done',
      nodeId: current.id,
      agentId: current.agentId,
      signal: outcome.signal,
      output: outcome.output,
      tokens: outcome.tokens,
    });

    const condition = conditionFor(outcome.signal);
    const outgoing = wf.edges.filter((e) => e.from === current!.id);
    // Prefer the signalled edge; fall back to on_complete, then a sole outgoing edge.
    const edge =
      outgoing.find((e) => e.condition === condition) ??
      outgoing.find((e) => e.condition === 'on_complete') ??
      (outgoing.length === 1 ? outgoing[0] : undefined);
    if (!edge) {
      emit({ type: 'no_outgoing_edge', nodeId: current.id, signal: outcome.signal });
      return finish('completed');
    }

    const key = `${edge.from}->${edge.to}:${edge.condition}`;
    const count = (loopCounts.get(key) ?? 0) + 1;
    loopCounts.set(key, count);
    const limit = edge.maxLoops ?? defaultMaxLoops;
    if (count > limit) {
      emit({ type: 'loop_capped', from: edge.from, to: edge.to, condition: edge.condition, limit });
      return finish('failed', `loop cap (${limit}) exceeded on ${key}`);
    }

    const target = wf.nodes.find((n) => n.id === edge.to);
    if (!target) return finish('failed', `dangling edge to "${edge.to}"`);

    emit({
      type: 'message',
      fromNodeId: current.id,
      toNodeId: target.id,
      fromAgentId: current.agentId,
      toAgentId: target.agentId,
      content: outcome.output,
    });
    message = outcome.output;
    current = target;
  }

  return finish('completed');
}
