import { nanoid } from 'nanoid';
import type { DB } from './db';
import type { NewWorkflow, Workflow } from '../domain/workflow';

interface WorkflowRow {
  id: string;
  name: string;
  description: string;
  is_template: number;
  entry_node_id: string;
  nodes: string;
  edges: string;
  created_at: string;
  updated_at: string;
}

function toWorkflow(r: WorkflowRow): Workflow {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    isTemplate: r.is_template === 1,
    entryNodeId: r.entry_node_id,
    nodes: JSON.parse(r.nodes),
    edges: JSON.parse(r.edges),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function makeWorkflowsRepo(db: DB) {
  const insert = db.prepare(
    `INSERT INTO workflows (id,name,description,is_template,entry_node_id,nodes,edges,created_at,updated_at)
     VALUES (@id,@name,@description,@is_template,@entry_node_id,@nodes,@edges,@created_at,@updated_at)`,
  );

  return {
    list(): Workflow[] {
      const rows = db.prepare('SELECT * FROM workflows ORDER BY created_at DESC').all() as WorkflowRow[];
      return rows.map(toWorkflow);
    },

    get(id: string): Workflow | null {
      const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id) as WorkflowRow | undefined;
      return row ? toWorkflow(row) : null;
    },

    create(input: NewWorkflow, id: string = nanoid(10)): Workflow {
      const now = new Date().toISOString();
      const wf: Workflow = { id, createdAt: now, updatedAt: now, ...input };
      insert.run({
        id: wf.id,
        name: wf.name,
        description: wf.description,
        is_template: wf.isTemplate ? 1 : 0,
        entry_node_id: wf.entryNodeId,
        nodes: JSON.stringify(wf.nodes),
        edges: JSON.stringify(wf.edges),
        created_at: wf.createdAt,
        updated_at: wf.updatedAt,
      });
      return wf;
    },

    /** Idempotent insert by fixed id — used to seed templates without duplicating on restart. */
    upsert(id: string, input: NewWorkflow): Workflow {
      if (this.get(id)) return this.get(id)!;
      return this.create(input, id);
    },

    remove(id: string): boolean {
      return db.prepare('DELETE FROM workflows WHERE id = ?').run(id).changes > 0;
    },
  };
}

export type WorkflowsRepo = ReturnType<typeof makeWorkflowsRepo>;
