import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Agent, Nav } from '../types';
import { initials } from '../ui';

export function Agents({ nav }: { nav: Nav }) {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    api.agents().then(setAgents).catch(() => undefined);
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Agents</h1>
          <p>The configurable workers. Each runs on Goose with its own prompt, tools, and guardrails.</p>
        </div>
        <button className="btn" onClick={() => nav('editor')}>+ New agent</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Agent</th><th>Role</th><th>Model</th><th>Tools</th><th>Channels</th></tr>
          </thead>
          <tbody>
            {agents.length === 0 && (
              <tr><td colSpan={5} className="empty">No agents yet — create one or run `npm run seed`.</td></tr>
            )}
            {agents.map((a) => (
              <tr key={a.id} className="clickable" onClick={() => nav('editor', a.id)}>
                <td>
                  <div className="row">
                    <span className="avatar">{initials(a.name)}</span>
                    <span style={{ fontWeight: 600 }}>{a.name}</span>
                  </div>
                </td>
                <td className="muted">{a.role}</td>
                <td className="mono small">{a.model}</td>
                <td>
                  {a.tools.length === 0 ? (
                    <span className="faint small">none</span>
                  ) : (
                    <span className="chan">{a.tools.length} · {a.tools.join(', ')}</span>
                  )}
                </td>
                <td>
                  {a.channels.map((c) => (
                    <span key={c} className={`pill tag${c === 'telegram' ? ' lime' : ''}`} style={{ marginRight: 6 }}>{c}</span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
