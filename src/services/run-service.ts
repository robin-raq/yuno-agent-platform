import type { RunsRepo } from '../db/runs';
import type { WorkflowsRepo } from '../db/workflows';
import { executeWorkflow, type EngineEvent, type NodeExecutor } from '../engine/engine';
import type { Run } from '../domain/workflow';

export interface RunServiceDeps {
  workflows: WorkflowsRepo;
  runs: RunsRepo;
  executor: NodeExecutor;
}

/**
 * Wires the pure engine to persistence: starts a Run, persists each step/message/event
 * as the engine emits them, and finalizes the Run with status + token total.
 */
export function makeRunService({ workflows, runs, executor }: RunServiceDeps) {
  return {
    async startRun(workflowId: string, initialMessage: string): Promise<Run | null> {
      const wf = workflows.get(workflowId);
      if (!wf) return null;

      const run = runs.createRun(workflowId);
      runs.addEvent({ runId: run.id, level: 'info', type: 'run_start', message: `Run started: ${wf.name}` });

      let openStepId: string | null = null;

      const emit = (e: EngineEvent): void => {
        switch (e.type) {
          case 'step_start':
            openStepId = runs.startStep({ runId: run.id, nodeId: e.nodeId, agentId: e.agentId, input: e.input });
            break;
          case 'step_done':
            if (openStepId) {
              runs.finalizeStep(openStepId, { status: 'done', output: e.output, signal: e.signal, tokens: e.tokens });
              openStepId = null;
            }
            runs.addEvent({
              runId: run.id,
              level: 'info',
              type: 'step_done',
              message: `${e.agentId} → ${e.signal}`,
            });
            break;
          case 'message':
            runs.addMessage({
              runId: run.id,
              fromAgentId: e.fromAgentId,
              toAgentId: e.toAgentId,
              channel: 'internal',
              direction: 'a2a',
              content: e.content,
            });
            break;
          case 'loop_capped':
            runs.addEvent({
              runId: run.id,
              level: 'warn',
              type: 'loop_capped',
              message: `Feedback loop capped on ${e.from}→${e.to} (limit ${e.limit})`,
            });
            break;
          case 'run_done':
            runs.addEvent({
              runId: run.id,
              level: e.status === 'completed' ? 'ok' : 'error',
              type: 'run_done',
              message: e.reason ? `${e.status}: ${e.reason}` : e.status,
            });
            break;
          default:
            break;
        }
      };

      const result = await executeWorkflow(wf, initialMessage, executor, { emit });
      runs.updateRun(run.id, {
        status: result.status,
        totalTokens: result.totalTokens,
        finishedAt: new Date().toISOString(),
      });
      return runs.getRun(run.id);
    },
  };
}

export type RunService = ReturnType<typeof makeRunService>;
