import { nanoid } from 'nanoid';
import type { DB } from './db';
import {
  type Agent,
  type AgentPatch,
  type CreateAgentInput,
  defaultGuardrails,
  defaultInteractionRules,
} from '../domain/types';

interface AgentRow {
  id: string;
  name: string;
  role: string;
  system_prompt: string;
  model: string;
  tools: string;
  channels: string;
  interaction_rules: string;
  guardrails: string;
  created_at: string;
  updated_at: string;
}

function toAgent(r: AgentRow): Agent {
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    systemPrompt: r.system_prompt,
    model: r.model,
    tools: JSON.parse(r.tools),
    channels: JSON.parse(r.channels),
    interactionRules: JSON.parse(r.interaction_rules),
    guardrails: JSON.parse(r.guardrails),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Repository factory — takes a DB so the server uses the singleton and tests use `:memory:`. */
export function makeAgentsRepo(db: DB) {
  return {
    list(): Agent[] {
      const rows = db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all() as AgentRow[];
      return rows.map(toAgent);
    },

    get(id: string): Agent | null {
      const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as AgentRow | undefined;
      return row ? toAgent(row) : null;
    },

    create(input: CreateAgentInput, id: string = nanoid(10)): Agent {
      const now = new Date().toISOString();
      const agent: Agent = {
        id,
        createdAt: now,
        updatedAt: now,
        ...input,
        guardrails: { ...defaultGuardrails(), ...input.guardrails },
        interactionRules: { ...defaultInteractionRules(), ...input.interactionRules },
      };
      db.prepare(
        `INSERT INTO agents (id,name,role,system_prompt,model,tools,channels,interaction_rules,guardrails,created_at,updated_at)
         VALUES (@id,@name,@role,@system_prompt,@model,@tools,@channels,@interaction_rules,@guardrails,@created_at,@updated_at)`,
      ).run({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        system_prompt: agent.systemPrompt,
        model: agent.model,
        tools: JSON.stringify(agent.tools),
        channels: JSON.stringify(agent.channels),
        interaction_rules: JSON.stringify(agent.interactionRules),
        guardrails: JSON.stringify(agent.guardrails),
        created_at: agent.createdAt,
        updated_at: agent.updatedAt,
      });
      return agent;
    },

    update(id: string, patch: AgentPatch): Agent | null {
      const existing = this.get(id);
      if (!existing) return null;
      const next: Agent = {
        ...existing,
        ...patch,
        id,
        guardrails: { ...existing.guardrails, ...patch.guardrails },
        interactionRules: { ...existing.interactionRules, ...patch.interactionRules },
        updatedAt: new Date().toISOString(),
      };
      db.prepare(
        `UPDATE agents SET name=@name, role=@role, system_prompt=@system_prompt, model=@model,
         tools=@tools, channels=@channels, interaction_rules=@interaction_rules, guardrails=@guardrails,
         updated_at=@updated_at WHERE id=@id`,
      ).run({
        id,
        name: next.name,
        role: next.role,
        system_prompt: next.systemPrompt,
        model: next.model,
        tools: JSON.stringify(next.tools),
        channels: JSON.stringify(next.channels),
        interaction_rules: JSON.stringify(next.interactionRules),
        guardrails: JSON.stringify(next.guardrails),
        updated_at: next.updatedAt,
      });
      return next;
    },

    /** Idempotent insert by fixed id — used to seed template agents without duplicating on restart. */
    upsert(id: string, input: CreateAgentInput): Agent {
      return this.get(id) ?? this.create(input, id);
    },

    remove(id: string): boolean {
      return db.prepare('DELETE FROM agents WHERE id = ?').run(id).changes > 0;
    },
  };
}

export type AgentsRepo = ReturnType<typeof makeAgentsRepo>;
