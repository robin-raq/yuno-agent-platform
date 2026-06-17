import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Nav, Workflow } from '../types';

export function Workflows({ nav }: { nav: Nav }) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);

  useEffect(() => {
    api.workflows().then(setWorkflows).catch(() => undefined);
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Workflows</h1>
          <p>Multi-agent graphs. Each routes on agent signals (complete / approve / reject).</p>
        </div>
        <button className="btn" onClick={() => nav('builder', 'new')}>+ New workflow</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {workflows.length === 0 && <div className="card empty">No workflows — run `npm run seed`.</div>}
        {workflows.map((w) => (
          <div key={w.id} className="card clickable" onClick={() => nav('builder', w.id)}>
            <div className="between" style={{ marginBottom: 8 }}>
              <h3>{w.name}</h3>
              {w.isTemplate && <span className="pill lime">template</span>}
            </div>
            <p className="muted small" style={{ margin: '0 0 12px' }}>{w.description}</p>
            <div className="row">
              <span className="pill tag">{w.nodes.length} nodes</span>
              <span className="pill tag">{w.edges.length} edges</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
