import { describe, expect, it } from 'vitest';
import { createDb } from '../src/db/db';
import { makeAgentsRepo } from '../src/db/agents';
import { makeWorkflowsRepo } from '../src/db/workflows';
import { makeRunsRepo } from '../src/db/runs';
import { makeRunService } from '../src/services/run-service';
import { buildServer } from '../src/server';
import { defaultGuardrails, defaultInteractionRules, type CreateAgentInput } from '../src/domain/types';
import type { NewWorkflow } from '../src/domain/workflow';
import type { NodeExecutor } from '../src/engine/engine';

function setup() {
  const db = createDb(':memory:');
  const agents = makeAgentsRepo(db);
  const workflows = makeWorkflowsRepo(db);
  const runs = makeRunsRepo(db);
  const mk = (name: string): CreateAgentInput => ({
    name,
    role: 'role',
    systemPrompt: 'prompt',
    model: 'm',
    tools: [],
    channels: ['internal'],
    interactionRules: defaultInteractionRules(),
    guardrails: defaultGuardrails(),
  });
  const intake = agents.create(mk('Intake'));
  const comp = agents.create(mk('Compliance'));
  const pay = agents.create(mk('Payout'));
  const wf: NewWorkflow = {
    name: 'Cross-Border Payout',
    description: '',
    isTemplate: true,
    entryNodeId: 'intake',
    nodes: [
      { id: 'intake', agentId: intake.id },
      { id: 'comp', agentId: comp.id },
      { id: 'pay', agentId: pay.id },
    ],
    edges: [
      { from: 'intake', to: 'comp', condition: 'on_complete' },
      { from: 'comp', to: 'intake', condition: 'on_reject', maxLoops: 2 },
      { from: 'comp', to: 'pay', condition: 'on_approve' },
    ],
  };
  const workflow = workflows.create(wf);
  return { db, workflows, runs, workflow };
}

const approveExecutor: NodeExecutor = async ({ node }) =>
  node.id === 'comp'
    ? { signal: 'approve', output: 'approved', tokens: 8 }
    : { signal: 'complete', output: `${node.id} done`, tokens: 5 };

describe('run service', () => {
  it('executes a workflow and persists steps, messages, and events', async () => {
    const { workflows, runs, workflow } = setup();
    const service = makeRunService({ workflows, runs, executor: approveExecutor });
    const run = await service.startRun(workflow.id, 'send $400 to MX');

    expect(run?.status).toBe('completed');
    expect(run?.totalTokens).toBe(18);

    const steps = runs.listSteps(run!.id);
    expect(steps.map((s) => s.nodeId)).toEqual(['intake', 'comp', 'pay']);
    expect(steps.every((s) => s.status === 'done')).toBe(true);

    expect(runs.listMessages(run!.id)).toHaveLength(2);
    expect(runs.recentEvents().some((e) => e.type === 'run_done')).toBe(true);
  });

  it('returns null for an unknown workflow', async () => {
    const { workflows, runs } = setup();
    const service = makeRunService({
      workflows,
      runs,
      executor: async () => ({ signal: 'complete', output: '', tokens: 0 }),
    });
    expect(await service.startRun('does-not-exist', 'hi')).toBeNull();
  });

  it('records a capped feedback loop as a failed run', async () => {
    const { workflows, runs, workflow } = setup();
    const executor: NodeExecutor = async ({ node }) =>
      node.id === 'comp'
        ? { signal: 'reject', output: 'incomplete', tokens: 1 }
        : { signal: 'complete', output: 'parsed', tokens: 1 };
    const run = await makeRunService({ workflows, runs, executor }).startRun(workflow.id, 'x');

    expect(run?.status).toBe('failed');
    expect(runs.recentEvents().some((e) => e.type === 'loop_capped')).toBe(true);
  });
});

describe('runs API (inject)', () => {
  it('POST /api/runs executes end-to-end and GET returns steps', async () => {
    const { db, workflow } = setup();
    const app = buildServer(db, { executor: approveExecutor });

    const started = await app.inject({
      method: 'POST',
      url: '/api/runs',
      payload: { workflowId: workflow.id, message: 'send $400 to MX' },
    });
    expect(started.statusCode).toBe(201);
    expect(started.json().status).toBe('completed');

    const detail = await app.inject({ method: 'GET', url: `/api/runs/${started.json().id}` });
    expect(detail.json().steps).toHaveLength(3);
    expect(detail.json().events.some((e: { type: string }) => e.type === 'run_done')).toBe(true);
    await app.close();
  });
});
