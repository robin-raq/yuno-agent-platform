import { describe, expect, it } from 'vitest';
import { createDb } from '../src/db/db';
import { buildServer } from '../src/server';

// The full MCP handshake is proven by scripts/mcp-smoke.ts against a real Goose process.
// Here we cover the route guard that runs before the socket is hijacked.
describe('MCP route', () => {
  it('returns 404 for an unknown agent', async () => {
    const app = buildServer(createDb(':memory:'));
    const res = await app.inject({ method: 'POST', url: '/mcp/does-not-exist', payload: {} });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'unknown agent' });
    await app.close();
  });
});
