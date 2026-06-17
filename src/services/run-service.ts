import type { RunsRepo } from '../db/runs';
import type { WorkflowsRepo } from '../db/workflows';
import { executeWorkflow, type EngineEvent, type NodeExecutor, type RunResult } from '../engine/engine';
import type { Run } from '../domain/workflow';

export interface RunServiceDeps {
  workflows: WorkflowsRepo;
  runs: RunsRepo;
  executor: NodeExecutor;
}

/**
 * Wires the pure engine to persistence: starts a Run, persists each step/message/event as the
 * engine emits them, and finalizes status + tokens. Supports pausing at a human-approval gate
 * (status awaiting_approval) and resuming via approve/reject.
 */
export function makeRunService({ workflows, runs, executor }: RunServiceDeps) {
  /** Per-run sink mapping engine events to persistence. */
  const makeEmit = (runId: string) => {
    let openStepId: string | null = null;
    return (e: EngineEvent): void => {
      switch (e.type) {
        case 'step_start':
          openStepId = runs.startStep({ runId, nodeId: e.nodeId, agentId: e.agentId, input: e.input });
          break;
        case 'step_done':
          if (openStepId) {
            runs.finalizeStep(openStepId, { status: 'done', output: e.output, signal: e.signal, tokens: e.tokens });
            openStepId = null;
          }
          runs.addEvent({ runId, level: 'info', type: 'step_done', message: `${e.agentId} → ${e.signal}` });
          break;
        case 'message':
          runs.addMessage({ runId, fromAgentId: e.fromAgentId, toAgentId: e.toAgentId, channel: 'internal', direction: 'a2a', content: e.content });
          break;
        case 'loop_capped':
          runs.addEvent({ runId, level: 'warn', type: 'loop_capped', message: `Feedback loop capped on ${e.from}→${e.to} (limit ${e.limit})` });
          break;
        case 'awaiting_approval':
          runs.addEvent({ runId, level: 'warn', type: 'awaiting_approval', message: `Paused for human approval at "${e.nodeId}"` });
          break;
        case 'run_done':
          runs.addEvent({ runId, level: e.status === 'completed' ? 'ok' : 'error', type: 'run_done', message: e.reason ? `${e.status}: ${e.reason}` : e.status });
          break;
        default:
          break;
      }
    };
  };

  const persist = (runId: string, result: RunResult, priorTokens: number): void => {
    if (result.status === 'awaiting_approval') {
      runs.updateRun(runId, {
        status: 'awaiting_approval',
        totalTokens: priorTokens + result.totalTokens,
        pendingNodeId: result.pendingNodeId,
        pendingMessage: result.pendingMessage,
      });
    } else {
      runs.updateRun(runId, {
        status: result.status,
        totalTokens: priorTokens + result.totalTokens,
        finishedAt: new Date().toISOString(),
        pendingNodeId: null,
        pendingMessage: null,
      });
    }
  };

  return {
    async startRun(workflowId: string, initialMessage: string): Promise<Run | null> {
      const wf = workflows.get(workflowId);
      if (!wf) return null;

      const run = runs.createRun(workflowId);
      runs.addEvent({ runId: run.id, level: 'info', type: 'run_start', message: `Run started: ${wf.name}` });
      const result = await executeWorkflow(wf, initialMessage, executor, { emit: makeEmit(run.id), runId: run.id });
      persist(run.id, result, 0);
      return runs.getRun(run.id);
    },

    /** Resume a run paused at an approval gate by following the gate's on_approve/on_reject edge. */
    async resumeRun(runId: string, decision: 'approve' | 'reject'): Promise<Run | null> {
      const run = runs.getRun(runId);
      if (!run || run.status !== 'awaiting_approval' || !run.pendingNodeId) return null;
      const wf = workflows.get(run.workflowId);
      if (!wf) return null;

      runs.addEvent({ runId, level: 'info', type: 'approval', message: `Human ${decision} at "${run.pendingNodeId}"` });
      const condition = decision === 'approve' ? 'on_approve' : 'on_reject';
      const edge = wf.edges.find((e) => e.from === run.pendingNodeId && e.condition === condition);
      if (!edge) {
        // No branch for this decision — terminal. approve→completed, reject→failed.
        runs.updateRun(runId, {
          status: decision === 'approve' ? 'completed' : 'failed',
          finishedAt: new Date().toISOString(),
          pendingNodeId: null,
          pendingMessage: null,
        });
        return runs.getRun(runId);
      }

      const result = await executeWorkflow(wf, '', executor, {
        emit: makeEmit(runId),
        runId,
        startNodeId: edge.to,
        startMessage: run.pendingMessage,
      });
      persist(runId, result, run.totalTokens);
      return runs.getRun(runId);
    },
  };
}

export type RunService = ReturnType<typeof makeRunService>;
