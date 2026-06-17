import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Agent, Nav, RunDetail } from '../types';
import { SignalPill, StatusPill, eventLevelClass, hhmmss, initials, shortId } from '../ui';

export function RunView({ runId, nav }: { runId: string; nav: Nav }) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    api.run(runId).then(setRun).catch(() => setRun(null));
    api.agents().then(setAgents).catch(() => undefined);
  }, [runId]);

  const name = (agentId?: string) => agents.find((a) => a.id === agentId)?.name ?? agentId ?? '—';

  if (!run) return <div className="card empty">Loading run…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <button className="btn line sm" onClick={() => nav('runs')}>← Runs</button>
          <h1 style={{ marginTop: 10 }}>Run {shortId(run.id)}</h1>
          <p>{run.steps.length} steps · {run.totalTokens.toLocaleString()} tokens · started {hhmmss(run.startedAt)}</p>
        </div>
        <StatusPill status={run.status} />
      </div>

      <div className="twocol">
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Steps</h3>
          <div className="trail">
            {run.steps.length === 0 && <div className="empty">No steps.</div>}
            {run.steps.map((s) => (
              <div key={s.id} className="msg">
                <span className="avatar">{initials(name(s.agentId))}</span>
                <div className="body">
                  <div className="meta">
                    <b>{name(s.agentId)}</b>
                    <SignalPill signal={s.signal} />
                    <span className="faint">{s.tokens.toLocaleString()} tok</span>
                  </div>
                  <div className="small">{s.output.slice(0, 500) || <span className="faint">(no output)</span>}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Event trail</h3>
          <div className="feed">
            {run.events.length === 0 && <div className="empty">No events.</div>}
            {run.events.map((e) => (
              <div className="ev" key={e.id}>
                <span className="t">{hhmmss(e.createdAt)}</span>
                <span className={`lvl ${eventLevelClass(e)}`} />
                <div><b>{e.type}</b> <span className="mono">{e.message}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3 style={{ marginBottom: 12 }}>Agent-to-agent messages</h3>
        <div className="trail">
          {run.messages.length === 0 && <div className="empty">No handoffs.</div>}
          {run.messages.map((m) => (
            <div key={m.id} className="msg">
              <span className="avatar">{initials(name(m.fromAgentId))}</span>
              <div className="body">
                <div className="meta">
                  <b>{name(m.fromAgentId)}</b> <span className="arr">→</span> <b>{name(m.toAgentId)}</b>
                </div>
                <div className="small">{m.content.slice(0, 500)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
