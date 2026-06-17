import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Nav, Run, Workflow } from '../types';
import { StatusPill, hhmmss, shortId } from '../ui';
import { RunView } from './RunView';

export function Runs({ runId, nav }: { runId?: string; nav: Nav }) {
  return runId ? <RunView runId={runId} nav={nav} /> : <RunsList nav={nav} />;
}

function RunsList({ nav }: { nav: Nav }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [wfId, setWfId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.workflows().then((w) => {
      setWorkflows(w);
      if (w[0]) setWfId(w[0].id);
    }).catch(() => undefined);
    api.runs().then(setRuns).catch(() => undefined);
  }, []);

  const wfName = (id: string) => workflows.find((w) => w.id === id)?.name ?? id;

  const start = async () => {
    if (!wfId || !message.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const run = await api.startRun(wfId, message.trim());
      nav('runs', run.id); // jump to the finished run's detail
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Runs</h1>
          <p>Trigger a workflow and watch the agents execute through real Goose.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 12 }}>Start a run</h3>
        <div className="field">
          <label>Workflow</label>
          <select value={wfId} onChange={(e) => setWfId(e.target.value)}>
            {workflows.length === 0 && <option>No workflows — run `npm run seed`</option>}
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>{w.name}{w.isTemplate ? ' (template)' : ''}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Send USD 8000 from Acme to Rodrigo Solano in Mexico."
          />
        </div>
        {error && <div className="small" style={{ color: 'var(--y-danger)', marginBottom: 10 }}>{error}</div>}
        <button className="btn" disabled={busy || !wfId || !message.trim()} onClick={start}>
          {busy ? 'Running… (real Goose — may take a moment)' : 'Run workflow'}
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Run</th><th>Workflow</th><th>Status</th><th>Tokens</th><th>Started</th></tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr><td colSpan={5} className="empty">No runs yet — start one above.</td></tr>
            )}
            {runs.map((r) => (
              <tr key={r.id} className="clickable" onClick={() => nav('runs', r.id)}>
                <td className="mono">{shortId(r.id)}</td>
                <td>{wfName(r.workflowId)}</td>
                <td><StatusPill status={r.status} /></td>
                <td className="mono">{r.totalTokens.toLocaleString()}</td>
                <td className="small faint">{hhmmss(r.startedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
