import { describe, expect, it } from 'vitest';
import { createDb } from '../src/db/db';
import { makeAgentsRepo } from '../src/db/agents';
import { makeRunsRepo } from '../src/db/runs';
import { makeCustomToolsRepo } from '../src/db/custom-tools';
import { buildMcpApp } from '../src/mcp/server';
import { buildServer } from '../src/server';

// The full MCP handshake is proven by scripts/mcp-smoke.ts against a real Goose process.
// Here we cover the route guard, and that MCP is NOT on the public app (it runs loopback-only).
describe('MCP server (loopback-only)', () => {
  const mcpApp = () => {
    const db = createDb(':memory:');
    return buildMcpApp({ agents: makeAgentsRepo(db), customTools: makeCustomToolsRepo(db), runs: makeRunsRepo(db) });
  };

  it('returns 404 for an unknown agent', async () => {
    const app = mcpApp();
    const res = await app.inject({ method: 'POST', url: '/mcp/does-not-exist', payload: {} });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'unknown agent' });
    await app.close();
  });

  it('does NOT expose /mcp on the public server', async () => {
    const app = buildServer(createDb(':memory:'));
    const res = await app.inject({ method: 'POST', url: '/mcp/anything', payload: {} });
    expect(res.statusCode).toBe(404); // not a registered route on the public app
    await app.close();
  });
});
