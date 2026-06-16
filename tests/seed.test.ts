import { describe, expect, it } from 'vitest';
import { createDb } from '../src/db/db';
import { makeAgentsRepo } from '../src/db/agents';
import { makeWorkflowsRepo } from '../src/db/workflows';
import { seedTemplates } from '../src/db/seed';

describe('seedTemplates', () => {
  it('seeds both PRD templates with graphs wired to existing agents', () => {
    const db = createDb(':memory:');
    seedTemplates(db);
    const workflows = makeWorkflowsRepo(db);
    const agents = makeAgentsRepo(db);

    const templates = workflows.list().filter((w) => w.isTemplate);
    expect(templates.map((t) => t.id).sort()).toEqual(['tpl-cbp', 'tpl-dev']);

    for (const wf of templates) {
      // Entry node exists in the graph.
      expect(wf.nodes.some((n) => n.id === wf.entryNodeId)).toBe(true);
      const nodeIds = new Set(wf.nodes.map((n) => n.id));
      // Every node points at an agent that was seeded (no dangling agent refs).
      for (const node of wf.nodes) expect(agents.get(node.agentId)).not.toBeNull();
      // Every edge connects nodes that exist (no dangling edges).
      for (const edge of wf.edges) {
        expect(nodeIds.has(edge.from)).toBe(true);
        expect(nodeIds.has(edge.to)).toBe(true);
      }
    }
  });

  it('wires the compliance gate to both approve and reject routes', () => {
    const db = createDb(':memory:');
    seedTemplates(db);
    const cbp = makeWorkflowsRepo(db).get('tpl-cbp')!;
    const fromComp = cbp.edges.filter((e) => e.from === 'comp').map((e) => e.condition);
    expect(fromComp).toContain('on_approve');
    expect(fromComp).toContain('on_reject');
  });

  it('is idempotent — re-seeding does not duplicate agents or workflows', () => {
    const db = createDb(':memory:');
    seedTemplates(db);
    seedTemplates(db);
    expect(makeWorkflowsRepo(db).list().filter((w) => w.isTemplate)).toHaveLength(2);
    const ids = makeAgentsRepo(db).list().map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
