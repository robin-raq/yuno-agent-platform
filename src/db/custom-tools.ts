import { z } from 'zod';
import type { DB } from './db';
import type { ToolDef } from '../tools/registry';

export interface CustomTool {
  name: string;
  description: string;
  params: string[];
  response: string;
  createdAt: string;
}

interface CustomToolRow {
  name: string;
  description: string;
  params: string;
  response: string;
  created_at: string;
}

const toCustomTool = (r: CustomToolRow): CustomTool => ({
  name: r.name,
  description: r.description,
  params: JSON.parse(r.params),
  response: r.response,
  createdAt: r.created_at,
});

/** Turn a stored custom tool into a callable ToolDef. The handler returns the configured mock
 *  response (parsed as JSON when possible, else echoed with the call args) — deterministic, safe. */
export function customToolDef(t: CustomTool): ToolDef {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const p of t.params) shape[p] = z.string().optional();
  return {
    name: t.name,
    description: t.description,
    inputSchema: shape,
    handler: (args) => {
      try {
        return JSON.parse(t.response);
      } catch {
        return { result: t.response, args };
      }
    },
  };
}

/** Repository for user-defined tools — extends the built-in registry at runtime. */
export function makeCustomToolsRepo(db: DB) {
  return {
    list(): CustomTool[] {
      const rows = db.prepare('SELECT * FROM custom_tools ORDER BY created_at DESC').all() as CustomToolRow[];
      return rows.map(toCustomTool);
    },

    /** All custom tools as callable ToolDefs (merged with built-ins by the registry resolver). */
    toolDefs(): ToolDef[] {
      return this.list().map(customToolDef);
    },

    get(name: string): CustomTool | null {
      const row = db.prepare('SELECT * FROM custom_tools WHERE name = ?').get(name) as CustomToolRow | undefined;
      return row ? toCustomTool(row) : null;
    },

    create(input: { name: string; description: string; params: string[]; response: string }): CustomTool {
      const tool: CustomTool = { ...input, createdAt: new Date().toISOString() };
      db.prepare(
        'INSERT INTO custom_tools (name,description,params,response,created_at) VALUES (?,?,?,?,?)',
      ).run(tool.name, tool.description, JSON.stringify(tool.params), tool.response, tool.createdAt);
      return tool;
    },

    remove(name: string): boolean {
      return db.prepare('DELETE FROM custom_tools WHERE name = ?').run(name).changes > 0;
    },
  };
}

export type CustomToolsRepo = ReturnType<typeof makeCustomToolsRepo>;
