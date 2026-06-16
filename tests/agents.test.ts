import { describe, expect, it } from 'vitest';
import { createDb } from '../src/db/db';
import { makeAgentsRepo } from '../src/db/agents';
import { buildServer } from '../src/server';
import { defaultGuardrails, defaultInteractionRules, type CreateAgentInput } from '../src/domain/types';

const sample = (): CreateAgentInput => ({
  name: 'Compliance',
  role: 'KYC / sanctions screening',
  systemPrompt: 'Screen each remittance against the sanctions list and limits.',
  model: 'claude-haiku-4-5-20251001',
  tools: ['screen_sanctions', 'check_limits'],
  channels: ['internal'],
  interactionRules: defaultInteractionRules(),
  guardrails: defaultGuardrails(),
});

describe('agents repository', () => {
  it('creates, reads, updates, lists, and removes', () => {
    const repo = makeAgentsRepo(createDb(':memory:'));
    const a = repo.create(sample());
    expect(a.id).toHaveLength(10);
    expect(repo.get(a.id)?.name).toBe('Compliance');
    expect(repo.list()).toHaveLength(1);

    const updated = repo.update(a.id, { name: 'Compliance v2' });
    expect(updated?.name).toBe('Compliance v2');
    expect(repo.get(a.id)?.name).toBe('Compliance v2');

    expect(repo.remove(a.id)).toBe(true);
    expect(repo.get(a.id)).toBeNull();
    expect(repo.list()).toHaveLength(0);
  });

  it('fills guardrail defaults when omitted', () => {
    const repo = makeAgentsRepo(createDb(':memory:'));
    const a = repo.create({ ...sample(), guardrails: {} });
    expect(a.guardrails.approvalThresholdUsd).toBe(5000);
    expect(a.guardrails.maxTokensPerRun).toBe(20000);
  });
});

describe('agents API (inject)', () => {
  it('POST creates (201) then GET returns it', async () => {
    const app = buildServer(createDb(':memory:'));
    const created = await app.inject({
      method: 'POST',
      url: '/api/agents',
      payload: { name: 'Intake', role: 'remittance intake', systemPrompt: 'Greet and parse.', model: 'claude-haiku-4-5-20251001' },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;

    const list = await app.inject({ method: 'GET', url: '/api/agents' });
    expect(list.json()).toHaveLength(1);

    const one = await app.inject({ method: 'GET', url: `/api/agents/${id}` });
    expect(one.json().name).toBe('Intake');
    await app.close();
  });

  it('rejects an invalid body with 400', async () => {
    const app = buildServer(createDb(':memory:'));
    const r = await app.inject({ method: 'POST', url: '/api/agents', payload: { name: '' } });
    expect(r.statusCode).toBe(400);
    await app.close();
  });

  it('404s for a missing agent', async () => {
    const app = buildServer(createDb(':memory:'));
    const r = await app.inject({ method: 'GET', url: '/api/agents/nope' });
    expect(r.statusCode).toBe(404);
    await app.close();
  });

  it('health reports ok + capability flags', async () => {
    const app = buildServer(createDb(':memory:'));
    const r = await app.inject({ method: 'GET', url: '/api/health' });
    const body = r.json();
    expect(body.ok).toBe(true);
    expect(body.capabilities).toHaveProperty('goose');
    await app.close();
  });
});
