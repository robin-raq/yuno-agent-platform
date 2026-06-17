import type { Agent, EventLog, Health, Run, RunDetail, Tool, Workflow } from './types';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => get<Health>('/api/health'),
  agents: () => get<Agent[]>('/api/agents'),
  workflows: () => get<Workflow[]>('/api/workflows'),
  runs: () => get<Run[]>('/api/runs'),
  run: (id: string) => get<RunDetail>(`/api/runs/${id}`),
  events: () => get<EventLog[]>('/api/events'),
  tools: () => get<Tool[]>('/api/tools'),

  async startRun(workflowId: string, message: string): Promise<Run> {
    const res = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workflowId, message }),
    });
    if (!res.ok) throw new Error(`start run → ${res.status}`);
    return res.json() as Promise<Run>;
  },
};
