import type { Agent, AgentInput, EvalReport, EventLog, Health, Message, Run, RunDetail, Tool, Workflow } from './types';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => get<Health>('/api/health'),
  agents: () => get<Agent[]>('/api/agents'),
  workflows: () => get<Workflow[]>('/api/workflows'),
  workflow: (id: string) => get<Workflow>(`/api/workflows/${id}`),
  runs: () => get<Run[]>('/api/runs'),
  run: (id: string) => get<RunDetail>(`/api/runs/${id}`),
  events: () => get<EventLog[]>('/api/events'),
  messages: () => get<Message[]>('/api/messages'),
  tools: () => get<Tool[]>('/api/tools'),
  evals: () => get<EvalReport>('/api/evals'),

  async startRun(workflowId: string, message: string): Promise<Run> {
    const res = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workflowId, message }),
    });
    if (!res.ok) throw new Error(`start run → ${res.status}`);
    return res.json() as Promise<Run>;
  },

  async resolveRun(id: string, decision: 'approve' | 'reject'): Promise<Run> {
    const res = await fetch(`/api/runs/${id}/${decision}`, { method: 'POST' });
    if (!res.ok) throw new Error(`${decision} run → ${res.status}`);
    return res.json() as Promise<Run>;
  },

  agent: (id: string) => get<Agent>(`/api/agents/${id}`),

  async saveAgent(input: AgentInput, id?: string): Promise<Agent> {
    const res = await fetch(id ? `/api/agents/${id}` : '/api/agents', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`save agent → ${res.status}`);
    return res.json() as Promise<Agent>;
  },

  async deleteAgent(id: string): Promise<void> {
    const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`delete agent → ${res.status}`);
  },
};
