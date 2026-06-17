import { useEffect, useState } from 'react';
import { api } from '../api';
import type { EvalReport } from '../types';

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function Evaluations() {
  const [report, setReport] = useState<EvalReport | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.evals().then(setReport).catch(() => setReport(null)).finally(() => setLoaded(true));
  }, []);

  if (loaded && (!report || report.empty)) {
    return (
      <>
        <Head />
        <div className="card empty">No eval results yet — run <span className="mono">npm run eval:ci</span> (free) or <span className="mono">npm run eval</span> (live).</div>
      </>
    );
  }
  if (!report) return <div className="card empty">Loading…</div>;

  const m = report.metrics;
  return (
    <>
      <Head />
      <div className="grid metrics" style={{ marginBottom: 18 }}>
        <div className="card metric">
          <div className="k">{pct(m.taskCompletionRate)}</div>
          <div className="l">Task completion rate</div>
          <div className="d muted">{m.passed}/{m.total} scenarios</div>
        </div>
        <div className="card metric">
          <div className="k">{pct(m.a2aReliability)}</div>
          <div className="l">A2A reliability</div>
          <div className="d muted">agent handoffs delivered</div>
        </div>
        <div className="card metric">
          <div className="k">{m.total}</div>
          <div className="l">Golden scenarios</div>
          <div className="d muted">
            <span className={`pill ${report.layer === 'live' ? 'lime' : 'tag'}`}>{report.layer}</span>
          </div>
        </div>
        <div className="card metric">
          <div className="k">{Object.keys(m.byTag).length}</div>
          <div className="l">Tags covered</div>
          <div className="d faint small">{new Date(report.generatedAt).toLocaleString()}</div>
        </div>
      </div>

      <div className="twocol">
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Scenario scorecard</h3>
          <div className="table-wrap" style={{ boxShadow: 'none' }}>
            <table>
              <thead><tr><th>Scenario</th><th>Tags</th><th>Result</th></tr></thead>
              <tbody>
                {report.scenarios.map((s) => (
                  <tr key={s.id}>
                    <td className="mono small">{s.id}</td>
                    <td className="faint small">{s.tags.join(', ')}</td>
                    <td>
                      <span className={`pill ${s.pass ? 'ok' : 'fail'}`}><span className="dot" />{s.pass ? 'pass' : 'fail'}</span>
                      {!s.pass && s.failures[0] && <span className="faint small" style={{ marginLeft: 8 }}>{s.failures[0]}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 12 }}>By tag</h3>
          <div className="stack">
            {Object.entries(m.byTag).sort().map(([tag, t]) => (
              <div className="between" key={tag}>
                <span className="pill tag">{tag}</span>
                <span className={`small ${t.passed === t.total ? 'up' : 'down'}`}>{t.passed}/{t.total}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Head() {
  return (
    <div className="page-head">
      <div>
        <h1>Evaluations</h1>
        <p>Golden scenarios replayed through the real engine. Task-completion-rate & A2A-reliability are two of the PRD's Key Impact Metrics.</p>
      </div>
    </div>
  );
}
