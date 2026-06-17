import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Agent, Nav } from '../types';

const CONDITIONS = ['on_complete', 'on_approve', 'on_reject'];

interface NodeRow {
  id: string;
  agentId: string;
  kind: 'agent' | 'gate';
}
interface EdgeRow {
  from: string;
  to: string;
  condition: string;
  maxLoops: string;
}

/** Form-based workflow authoring — saves via POST /api/workflows, then opens the graph view. */
export function WorkflowEditor({ nav }: { nav: Nav }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nodes, setNodes] = useState<NodeRow[]>([{ id: 'intake', agentId: '', kind: 'agent' }]);
  const [edges, setEdges] = useState<EdgeRow[]>([]);
  const [entryNodeId, setEntryNodeId] = useState('intake');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.agents().then(setAgents).catch(() => undefined);
  }, []);

  const nodeIds = nodes.map((n) => n.id.trim()).filter(Boolean);
  const setNode = (i: number, patch: Partial<NodeRow>) => setNodes(nodes.map((n, j) => (j === i ? { ...n, ...patch } : n)));
  const setEdge = (i: number, patch: Partial<EdgeRow>) => setEdges(edges.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError('Name is required.');
    const cleanNodes = nodes.filter((n) => n.id.trim() && n.agentId);
    if (cleanNodes.length === 0) return setError('Add at least one node with an id and an agent.');
    if (!entryNodeId || !cleanNodes.some((n) => n.id.trim() === entryNodeId)) return setError('Pick a valid entry node.');
    const cleanEdges = edges.filter((e) => e.from && e.to);

    setBusy(true);
    try {
      const wf = await api.createWorkflow({
        name: name.trim(),
        description: description.trim(),
        isTemplate: false,
        entryNodeId,
        nodes: cleanNodes.map((n) => ({ id: n.id.trim(), agentId: n.agentId, kind: n.kind })),
        edges: cleanEdges.map((e) => ({
          from: e.from,
          to: e.to,
          condition: e.condition,
          ...(e.maxLoops ? { maxLoops: Number(e.maxLoops) } : {}),
        })),
      });
      nav('builder', wf.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <button className="btn line sm" onClick={() => nav('workflows')}>← Workflows</button>
          <h1 style={{ marginTop: 10 }}>New workflow</h1>
          <p>Add agent nodes, connect them with signal-conditioned edges, and pick the entry node.</p>
        </div>
        <button className="btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save workflow'}</button>
      </div>

      <div className="card" style={{ maxWidth: 860 }}>
        <div className="field">
          <label>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My remittance flow" />
        </div>
        <div className="field">
          <label>Description</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="field">
          <label>Nodes</label>
          {nodes.map((n, i) => (
            <div className="kv" key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input style={{ flex: '0 0 130px' }} type="text" value={n.id} placeholder="node id" onChange={(e) => setNode(i, { id: e.target.value })} />
              <select style={{ flex: 1 }} value={n.agentId} onChange={(e) => setNode(i, { agentId: e.target.value })}>
                <option value="">— agent —</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
              </select>
              <select style={{ flex: '0 0 110px' }} value={n.kind} onChange={(e) => setNode(i, { kind: e.target.value as NodeRow['kind'] })}>
                <option value="agent">agent</option>
                <option value="gate">gate</option>
              </select>
              <button className="btn line sm" onClick={() => setNodes(nodes.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button className="btn ghost sm" onClick={() => setNodes([...nodes, { id: '', agentId: '', kind: 'agent' }])}>+ Add node</button>
        </div>

        <div className="field">
          <label>Entry node</label>
          <select value={entryNodeId} onChange={(e) => setEntryNodeId(e.target.value)}>
            <option value="">— entry —</option>
            {nodeIds.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Edges</label>
          {edges.length === 0 && <div className="faint small" style={{ marginBottom: 8 }}>No edges yet — a single-node workflow is valid too.</div>}
          {edges.map((e, i) => (
            <div className="kv" key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <select style={{ flex: 1 }} value={e.from} onChange={(ev) => setEdge(i, { from: ev.target.value })}>
                <option value="">— from —</option>
                {nodeIds.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
              <span className="arr" style={{ alignSelf: 'center' }}>→</span>
              <select style={{ flex: 1 }} value={e.to} onChange={(ev) => setEdge(i, { to: ev.target.value })}>
                <option value="">— to —</option>
                {nodeIds.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
              <select style={{ flex: '0 0 140px' }} value={e.condition} onChange={(ev) => setEdge(i, { condition: ev.target.value })}>
                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input style={{ flex: '0 0 90px' }} type="number" value={e.maxLoops} placeholder="maxLoops" onChange={(ev) => setEdge(i, { maxLoops: ev.target.value })} />
              <button className="btn line sm" onClick={() => setEdges(edges.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button className="btn ghost sm" onClick={() => setEdges([...edges, { from: '', to: '', condition: 'on_complete', maxLoops: '' }])}>+ Add edge</button>
        </div>

        {error && <div className="small" style={{ color: 'var(--y-danger)', marginBottom: 10 }}>{error}</div>}
        <button className="btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save workflow'}</button>
      </div>
    </>
  );
}
