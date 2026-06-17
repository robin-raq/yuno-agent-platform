import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from './api';
import type { Health, Route } from './types';
import { Dashboard } from './screens/Dashboard';
import { Runs } from './screens/Runs';
import { Agents } from './screens/Agents';
import { AgentEditor } from './screens/AgentEditor';
import { Workflows } from './screens/Workflows';
import { Builder } from './screens/Builder';
import { WorkflowEditor } from './screens/WorkflowEditor';
import { Evaluations } from './screens/Evaluations';
import { Channels } from './screens/Channels';

interface NavItem {
  route: Route;
  label: string;
  icon: ReactNode;
  sep?: boolean;
}

const ic = (paths: ReactNode): ReactNode => (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    {paths}
  </svg>
);

const NAV: NavItem[] = [
  { route: 'dashboard', label: 'Dashboard', icon: ic(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="11" width="7" height="10" rx="1.5" /><rect x="3" y="15" width="7" height="6" rx="1.5" /></>) },
  { route: 'agents', label: 'Agents', icon: ic(<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c.6-3.3 3-5 5.5-5s4.9 1.7 5.5 5" /><circle cx="17.5" cy="8" r="2.4" /><path d="M16 14.4c2 .3 3.6 1.8 4 5" /></>) },
  { route: 'editor', label: 'Agent Editor', icon: ic(<><path d="M4 17.5 14 7.5l2.5 2.5L6.5 20H4z" /><path d="M14.5 7 17 4.5 19.5 7 17 9.5z" /></>) },
  { route: 'workflows', label: 'Workflows', sep: true, icon: ic(<><rect x="3" y="4" width="6" height="4" rx="1" /><rect x="15" y="9" width="6" height="4" rx="1" /><rect x="3" y="16" width="6" height="4" rx="1" /><path d="M9 6h3v12H9M12 11h3" /></>) },
  { route: 'builder', label: 'Workflow Builder', icon: ic(<><circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="6" r="2.4" /><circle cx="12" cy="18" r="2.4" /><path d="M8 7l8 0M7 8l4 8M17 8l-4 8" /></>) },
  { route: 'runs', label: 'Runs', icon: ic(<path d="M5 4v16M5 4l13 4-13 4" />) },
  { route: 'channels', label: 'Channels', icon: ic(<path d="M4 5h16v11H8l-4 3z" />) },
  { route: 'evals', label: 'Evaluations', icon: ic(<><rect x="4" y="4" width="16" height="16" rx="2.5" /><path d="M8.5 12l2.2 2.2L15.5 9.5" /></>) },
];

const LABEL: Record<Route, string> = Object.fromEntries(NAV.map((n) => [n.route, n.label])) as Record<Route, string>;

export function App() {
  const [route, setRoute] = useState<Route>('dashboard');
  const [param, setParam] = useState<string | undefined>(undefined); // runId or agentId, per route
  const [health, setHealth] = useState<Health | null>(null);

  const nav = (r: Route, id?: string) => {
    setRoute(r);
    setParam(id);
  };

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="mark">yuno</span>
          <div><div className="sub">Agents</div></div>
        </div>
        {NAV.map((n) => (
          <div key={n.route}>
            {n.sep && <div className="nav-sep" />}
            <div
              className={`nav-item${route === n.route ? ' active' : ''}`}
              data-route={n.route}
              onClick={() => nav(n.route)}
            >
              {n.icon} {n.label}
            </div>
          </div>
        ))}
        <div className="foot">Goose 1.37 · Anthropic<br />Local + Railway · v0.1</div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="crumb">Workspace / {LABEL[route]}</div>
          <div className="row">
            <span className={`live-pill${health?.ok ? '' : ' off'}`}>
              <span className="live-dot" /> {health?.ok ? 'API connected' : 'API offline'}
            </span>
            <span className="avatar">YO</span>
          </div>
        </div>

        <div className="content">
          {route === 'dashboard' && <Dashboard nav={nav} />}
          {route === 'agents' && <Agents nav={nav} />}
          {route === 'editor' && <AgentEditor agentId={param} nav={nav} />}
          {route === 'workflows' && <Workflows nav={nav} />}
          {route === 'builder' && (param === 'new' ? <WorkflowEditor nav={nav} /> : <Builder workflowId={param} nav={nav} />)}
          {route === 'runs' && <Runs runId={param} nav={nav} />}
          {route === 'evals' && <Evaluations />}
          {route === 'channels' && <Channels />}
        </div>
      </div>
    </div>
  );
}
