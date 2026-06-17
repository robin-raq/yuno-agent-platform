import type { Agent, EventLog, Health, Run, Tool } from './types';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => get<Health>('/api/health'),
  agents: () => get<Agent[]>('/api/agents'),
  runs: () => get<Run[]>('/api/runs'),
  events: () => get<EventLog[]>('/api/events'),
  tools: () => get<Tool[]>('/api/tools'),
};
