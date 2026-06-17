import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Agent, Nav, Workflow } from '../types';
import { initials } from '../ui';

const COND_CLASS: Record<string, string> = { on_complete: 'run', on_approve: 'ok', on_reject: 'fail' };
const COND_LABEL: Record<string, string> = { on_complete: '→ complete', on_approve: '✓ approve', on_reject: '↺ reject' };

export function Builder({ workflowId, nav }: { workflowId?: string; nav: Nav }) {
  const [wf, setWf] = useState<Workflow | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    if (workflowId) api.workflow(workflowId).then(setWf).catch(() => setWf(null));
    api.agents().then(setAgents).catch(() => undefined);
  }, [workflowId]);

  const agent = (agentId: string) => agents.find((a) => a.id === agentId);

  if (!workflowId) return <div className="card empty">Pick a workflow from the Workflows screen.</div>;
  if (!wf) return <div className="card empty">Loading workflow…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <button className="btn line sm" onClick={() => nav('workflows')}>← Workflows</button>
          <h1 style={{ marginTop: 10 }}>{wf.name}</h1>
          <p>{wf.description}</p>
        </div>
        <button className="btn" onClick={() => nav('runs')}>Run this workflow</button>
      </div>

      <div className="stack" style={{ gap: 0 }}>
        {wf.nodes.map((node) => {
          const a = agent(node.agentId);
          const outgoing = wf.edges.filter((e) => e.from === node.id);
          return (
            <div key={node.id}>
              <div className="gnode-card">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="row">
                    <span className="avatar">{initials(a?.name ?? node.id)}</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {a?.name ?? node.agentId}
                        {node.id === wf.entryNodeId && <span className="pill tag" style={{ marginLeft: 8 }}>entry</span>}
                      </div>
                      <div className="small faint">{a?.role ?? 'node'} · {node.id}</div>
                    </div>
                  </div>
                  {a && a.tools.length > 0 && (
                    <div className="chips">
                      {a.tools.map((t) => <span key={t} className="chip">{t}</span>)}
                    </div>
                  )}
                </div>
              </div>
              {outgoing.map((e, i) => (
                <div className="edge" key={i}>
                  <span className={`pill ${COND_CLASS[e.condition] ?? 'idle'}`}>
                    <span className="dot" />{COND_LABEL[e.condition] ?? e.condition}
                  </span>
                  <span className="arr">→</span>
                  <b>{agent(wf.nodes.find((n) => n.id === e.to)?.agentId ?? '')?.name ?? e.to}</b>
                  {e.maxLoops && <span className="faint small">(max {e.maxLoops})</span>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
