import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AgentInput, Nav, Tool } from '../types';

const BLANK: AgentInput = {
  name: '',
  role: '',
  systemPrompt: '',
  model: 'claude-sonnet-4-6',
  tools: [],
  channels: ['internal'],
  guardrails: { approvalThresholdUsd: 5000, maxTokensPerRun: 20000, blockedActions: [] },
};

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

export function AgentEditor({ agentId, nav }: { agentId?: string; nav: Nav }) {
  const [form, setForm] = useState<AgentInput>(BLANK);
  const [allTools, setAllTools] = useState<Tool[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTool, setShowTool] = useState(false);
  const [nt, setNt] = useState({ name: '', description: '', params: '', response: '{}' });
  const [toolErr, setToolErr] = useState<string | null>(null);

  const addTool = async () => {
    if (!nt.name.trim() || !nt.description.trim()) return setToolErr('Name and description are required.');
    setToolErr(null);
    try {
      await api.createTool({
        name: nt.name.trim(),
        description: nt.description.trim(),
        params: nt.params.split(',').map((s) => s.trim()).filter(Boolean),
        response: nt.response.trim() || '{}',
      });
      setAllTools(await api.tools());
      set('tools', [...form.tools, nt.name.trim()]); // auto-grant the new tool
      setNt({ name: '', description: '', params: '', response: '{}' });
      setShowTool(false);
    } catch (e) {
      setToolErr((e as Error).message);
    }
  };

  useEffect(() => {
    api.tools().then(setAllTools).catch(() => undefined);
    if (!agentId) return;
    api.agent(agentId).then((a) =>
      setForm({
        name: a.name,
        role: a.role,
        systemPrompt: a.systemPrompt,
        model: a.model,
        tools: a.tools,
        channels: a.channels,
        guardrails: {
          approvalThresholdUsd: a.guardrails.approvalThresholdUsd,
          maxTokensPerRun: a.guardrails.maxTokensPerRun,
          blockedActions: a.guardrails.blockedActions,
        },
      }),
    ).catch(() => undefined);
  }, [agentId]);

  const set = <K extends keyof AgentInput>(key: K, value: AgentInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setGuard = (patch: Partial<AgentInput['guardrails']>) =>
    setForm((f) => ({ ...f, guardrails: { ...f.guardrails, ...patch } }));

  const save = async () => {
    if (!form.name.trim() || !form.role.trim() || !form.systemPrompt.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.saveAgent(form, agentId);
      nav('agents');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!agentId || busy) return;
    setBusy(true);
    try {
      await api.deleteAgent(agentId);
      nav('agents');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <button className="btn line sm" onClick={() => nav('agents')}>← Agents</button>
          <h1 style={{ marginTop: 10 }}>{agentId ? 'Edit agent' : 'New agent'}</h1>
          <p>Identity, tools the agent may call, and guardrails the platform enforces.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <div className="field">
          <label>Name</label>
          <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Compliance" />
        </div>
        <div className="field">
          <label>Role</label>
          <input type="text" value={form.role} onChange={(e) => set('role', e.target.value)} placeholder="screening" />
        </div>
        <div className="field">
          <label>Model</label>
          <input type="text" value={form.model} onChange={(e) => set('model', e.target.value)} />
        </div>
        <div className="field">
          <label>System prompt</label>
          <textarea value={form.systemPrompt} onChange={(e) => set('systemPrompt', e.target.value)} />
        </div>

        <div className="field">
          <label>Tools</label>
          <div className="chips">
            {allTools.length === 0 && <span className="faint small">no tools registered</span>}
            {allTools.map((t) => (
              <span
                key={t.name}
                className={`chip${form.tools.includes(t.name) ? '' : ' off'} clickable`}
                title={t.description}
                onClick={() => set('tools', toggle(form.tools, t.name))}
              >
                {t.name}{t.custom ? ' ·custom' : ''}
              </span>
            ))}
            <span className="chip clickable" style={{ background: 'var(--y-accent)', color: '#41510a' }} onClick={() => setShowTool((s) => !s)}>
              + custom tool
            </span>
          </div>
          {showTool && (
            <div className="card" style={{ marginTop: 10, boxShadow: 'none', background: 'var(--y-surface-2)' }}>
              <div className="field" style={{ marginBottom: 10 }}>
                <label>Tool name (lowercase_with_underscores)</label>
                <input type="text" value={nt.name} onChange={(e) => setNt({ ...nt, name: e.target.value })} placeholder="get_weather" />
              </div>
              <div className="field" style={{ marginBottom: 10 }}>
                <label>Description (the agent reads this)</label>
                <input type="text" value={nt.description} onChange={(e) => setNt({ ...nt, description: e.target.value })} placeholder="Get the current weather for a city" />
              </div>
              <div className="field" style={{ marginBottom: 10 }}>
                <label>Params (comma-separated)</label>
                <input type="text" value={nt.params} onChange={(e) => setNt({ ...nt, params: e.target.value })} placeholder="city" />
              </div>
              <div className="field" style={{ marginBottom: 10 }}>
                <label>Mock response (JSON the tool returns)</label>
                <input type="text" value={nt.response} onChange={(e) => setNt({ ...nt, response: e.target.value })} placeholder='{"tempC": 21, "sky": "clear"}' />
              </div>
              {toolErr && <div className="small" style={{ color: 'var(--y-danger)', marginBottom: 8 }}>{toolErr}</div>}
              <button className="btn sm" onClick={addTool}>Create tool</button>
            </div>
          )}
        </div>

        <div className="field">
          <label>Channels</label>
          <div className="chips">
            {['internal', 'telegram'].map((c) => (
              <span
                key={c}
                className={`chip${form.channels.includes(c) ? '' : ' off'} clickable`}
                onClick={() => set('channels', toggle(form.channels, c))}
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Approval threshold (USD)</label>
          <input
            type="number"
            value={form.guardrails.approvalThresholdUsd}
            onChange={(e) => setGuard({ approvalThresholdUsd: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>Max tokens per run</label>
          <input
            type="number"
            value={form.guardrails.maxTokensPerRun}
            onChange={(e) => setGuard({ maxTokensPerRun: Number(e.target.value) })}
          />
        </div>

        {form.tools.length > 0 && (
          <div className="field">
            <label>Blocked actions (deny granted tools at the boundary)</label>
            <div className="chips">
              {form.tools.map((t) => (
                <span
                  key={t}
                  className={`chip${form.guardrails.blockedActions.includes(t) ? ' lime' : ' off'} clickable`}
                  onClick={() => setGuard({ blockedActions: toggle(form.guardrails.blockedActions, t) })}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {error && <div className="small" style={{ color: 'var(--y-danger)', marginBottom: 10 }}>{error}</div>}
        <div className="row">
          <button className="btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save agent'}</button>
          {agentId && <button className="btn danger" disabled={busy} onClick={remove}>Delete</button>}
        </div>
      </div>
    </>
  );
}
