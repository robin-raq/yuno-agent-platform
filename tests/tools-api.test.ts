import { describe, expect, it } from 'vitest';
import { createDb } from '../src/db/db';
import { buildServer } from '../src/server';

describe('GET /api/tools (UI catalog)', () => {
  it('lists tool metadata with parameter names', async () => {
    const app = buildServer(createDb(':memory:'));
    const res = await app.inject({ method: 'GET', url: '/api/tools' });
    expect(res.statusCode).toBe(200);
    const payout = res.json().find((t: { name: string }) => t.name === 'initiate_payout');
    expect(payout.params).toContain('amountUsd');
    expect(payout.description).toContain('SIMULATED');
    await app.close();
  });
});
