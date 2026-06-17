import { describe, expect, it } from 'vitest';
import type { Workflow } from '../src/domain/workflow';
import { executeWorkflow, findEntryNode, type EngineEvent, type NodeExecutor } from '../src/engine/engine';

/** Remittance-shaped fixture: Intake -> Compliance, with a reject feedback loop and an approve exit. */
const wf = (): Workflow => ({
  id: 'w1',
  name: 'Cross-Border Payout (test)',
  description: '',
  isTemplate: true,
  entryNodeId: 'intake',
  nodes: [
    { id: 'intake', agentId: 'a_in' },
    { id: 'comp', agentId: 'a_co' },
    { id: 'pay', agentId: 'a_pa' },
  ],
  edges: [
    { from: 'intake', to: 'comp', condition: 'on_complete' },
    { from: 'comp', to: 'intake', condition: 'on_reject', maxLoops: 2 },
    { from: 'comp', to: 'pay', condition: 'on_approve' },
  ],
  createdAt: '',
  updatedAt: '',
});

describe('findEntryNode', () => {
  it('uses the explicit entry even when it has an incoming (feedback) edge', () => {
    expect(findEntryNode(wf())?.id).toBe('intake');
  });
});

describe('executeWorkflow', () => {
  it('runs the happy path and ends at a node with no matching edge', async () => {
    const exec: NodeExecutor = async ({ node }) => {
      if (node.id === 'intake') return { signal: 'complete', output: 'parsed', tokens: 5 };
      if (node.id === 'comp') return { signal: 'approve', output: 'approved', tokens: 8 };
      return { signal: 'complete', output: 'paid', tokens: 3 };
    };
    const r = await executeWorkflow(wf(), 'send $400', exec);
    expect(r.status).toBe('completed');
    expect(r.steps.map((s) => s.nodeId)).toEqual(['intake', 'comp', 'pay']);
    expect(r.totalTokens).toBe(16);
  });

  it('follows the reject feedback loop, then approves', async () => {
    let compVisits = 0;
    const exec: NodeExecutor = async ({ node }) => {
      if (node.id === 'comp') {
        compVisits += 1;
        return compVisits === 1
          ? { signal: 'reject', output: 'needs recipient bank', tokens: 1 }
          : { signal: 'approve', output: 'ok', tokens: 1 };
      }
      if (node.id === 'intake') return { signal: 'complete', output: 'parsed', tokens: 1 };
      return { signal: 'complete', output: 'paid', tokens: 1 };
    };
    const r = await executeWorkflow(wf(), 'send $400', exec);
    expect(r.status).toBe('completed');
    expect(r.steps.map((s) => s.nodeId)).toEqual(['intake', 'comp', 'intake', 'comp', 'pay']);
  });

  it('caps a runaway feedback loop and fails safely', async () => {
    const events: EngineEvent[] = [];
    const exec: NodeExecutor = async ({ node }) =>
      node.id === 'comp'
        ? { signal: 'reject', output: 'still bad', tokens: 1 }
        : { signal: 'complete', output: 'parsed', tokens: 1 };
    const r = await executeWorkflow(wf(), 'send $400', exec, { emit: (e) => events.push(e) });
    expect(r.status).toBe('failed');
    expect(r.reason).toMatch(/loop cap/);
    expect(r.steps).toHaveLength(6); // intake,comp x3 before the 3rd reject trips the cap of 2
    expect(events.some((e) => e.type === 'loop_capped')).toBe(true);
  });

  it('emits an a2a message on every handoff', async () => {
    const messages: EngineEvent[] = [];
    const exec: NodeExecutor = async ({ node }) =>
      node.id === 'comp'
        ? { signal: 'approve', output: 'approved', tokens: 1 }
        : { signal: 'complete', output: node.id, tokens: 1 };
    await executeWorkflow(wf(), 'go', exec, { emit: (e) => e.type === 'message' && messages.push(e) });
    // intake->comp and comp->pay
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ fromNodeId: 'intake', toNodeId: 'comp' });
  });

  it('pauses at a gate node without executing it, then resumes past it', async () => {
    const gated = (): Workflow => ({
      id: 'g1', name: 'gated', description: '', isTemplate: false, entryNodeId: 'a',
      nodes: [{ id: 'a', agentId: 'ag' }, { id: 'gate', agentId: 'hum', kind: 'gate' }, { id: 'b', agentId: 'bg' }],
      edges: [
        { from: 'a', to: 'gate', condition: 'on_complete' },
        { from: 'gate', to: 'b', condition: 'on_approve' },
      ],
      createdAt: '', updatedAt: '',
    });
    const exec: NodeExecutor = async ({ node }) => ({ signal: 'complete', output: `${node.id} done`, tokens: 1 });

    const paused = await executeWorkflow(gated(), 'go', exec);
    expect(paused.status).toBe('awaiting_approval');
    expect(paused.pendingNodeId).toBe('gate');
    expect(paused.steps.map((s) => s.nodeId)).toEqual(['a']); // gate itself not executed

    const resumed = await executeWorkflow(gated(), '', exec, { startNodeId: 'b', startMessage: 'approved' });
    expect(resumed.status).toBe('completed');
    expect(resumed.steps.map((s) => s.nodeId)).toEqual(['b']);
  });

  it('threads the run id from options through to the executor', async () => {
    const seen: Array<string | undefined> = [];
    const exec: NodeExecutor = async ({ node, runId }) => {
      seen.push(runId);
      return node.id === 'comp'
        ? { signal: 'approve', output: 'ok', tokens: 1 }
        : { signal: 'complete', output: node.id, tokens: 1 };
    };
    await executeWorkflow(wf(), 'go', exec, { runId: 'run-123' });
    expect(seen).toContain('run-123');
    expect(seen.every((r) => r === 'run-123')).toBe(true);
  });
});
