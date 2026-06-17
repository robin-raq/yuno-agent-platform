import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Agent, EventLog, Health, Run } from '../types';

const initials = (name: string) =>
  name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

const hhmmss = (iso: string) => new Date(iso).toLocaleTimeString([], { hour12: false });

const levelClass = (e: EventLog) => (e.type === 'tool_call' ? 'tool' : e.level);

export function Dashboard({ onNavigateRuns }: { onNavigateRuns: () => void }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [events, setEvents] = useState<EventLog[]>([]);

  useEffect(() => {
    Promise.all([api.health(), api.agents(), api.runs(), api.events()])
      .then(([h, a, r, e]) => {
        setHealth(h);
        setAgents(a);
        setRuns(r);
        setEvents(e);
      })
      .catch(() => undefined);
  }, []);

  const activeRuns = runs.filter((r) => r.status === 'running' || r.status === 'awaiting_approval').length;
  const totalTokens = runs.reduce((sum, r) => sum + r.totalTokens, 0);
  const onTelegram = agents.filter((a) => a.channels.includes('telegram')).length;
  const caps = health?.capabilities;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Live view of agents, runs, and spend across the workspace.</p>
        </div>
        <button className="btn" onClick={onNavigateRuns}>View runs</button>
      </div>

      <div className="grid metrics" style={{ marginBottom: 18 }}>
        <div className="card metric">
          <div className="k">{agents.length}</div>
          <div className="l">Configured agents</div>
          <div className="d muted">{onTelegram} on Telegram</div>
        </div>
        <div className="card metric">
          <div className="k">{activeRuns}</div>
          <div className="l">Active runs</div>
          <div className="d muted">{runs.length} total</div>
        </div>
        <div className="card metric">
          <div className="k">{(totalTokens / 1000).toFixed(1)}k</div>
          <div className="l">Tokens (all runs)</div>
          <div className="d muted">real usage from Goose</div>
        </div>
        <div className="card metric">
          <div className="k">{caps?.goose ? 'on' : 'off'}</div>
          <div className="l">Runtime</div>
          <div className="d muted">
            telegram {caps?.telegram ? 'on' : 'off'} · payments {caps?.payments ? 'on' : 'off'}
          </div>
        </div>
      </div>

      <div className="twocol">
        <div className="card">
          <div className="between" style={{ marginBottom: 12 }}>
            <h3>Recent event feed</h3>
            <span className="pill run"><span className="dot" /> {events.length} events</span>
          </div>
          <div className="feed">
            {events.length === 0 && <div className="empty">No events yet — start a run to see activity.</div>}
            {events.map((e) => (
              <div className="ev" key={e.id}>
                <span className="t">{hhmmss(e.createdAt)}</span>
                <span className={`lvl ${levelClass(e)}`} />
                <div><b>{e.type}</b> <span className="mono">{e.message}</span></div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Agents</h3>
          <div className="stack">
            {agents.length === 0 && <div className="empty">No agents yet — seed runs `npm run seed`.</div>}
            {agents.slice(0, 8).map((a) => (
              <div className="between" key={a.id}>
                <div className="row">
                  <span className="avatar">{initials(a.name)}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    <div className="small faint">
                      {a.role}{a.tools.length ? ` · ${a.tools.length} tools` : ''}
                    </div>
                  </div>
                </div>
                <span className="pill idle"><span className="dot" /> ready</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
