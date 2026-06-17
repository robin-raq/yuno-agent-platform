import { describe, expect, it } from 'vitest';
import { createDb } from '../src/db/db';
import { makeCustomToolsRepo, customToolDef } from '../src/db/custom-tools';
import { buildServer } from '../src/server';

describe('custom tools repo', () => {
  it('creates and lists a custom tool', () => {
    const repo = makeCustomToolsRepo(createDb(':memory:'));
    repo.create({ name: 'get_weather', description: 'mock weather', params: ['city'], response: '{"temp":21}' });
    expect(repo.list().map((t) => t.name)).toEqual(['get_weather']);
  });

  it('customToolDef returns the configured JSON response', async () => {
    const def = customToolDef({ name: 'get_weather', description: '', params: ['city'], response: '{"temp":21}', createdAt: '' });
    expect(await def.handler({ city: 'Lagos' }, { agentId: 'a' })).toEqual({ temp: 21 });
  });

  it('echoes args when the response is not JSON', async () => {
    const def = customToolDef({ name: 'echo', description: '', params: ['x'], response: 'hi', createdAt: '' });
    expect(await def.handler({ x: '1' }, { agentId: 'a' })).toEqual({ result: 'hi', args: { x: '1' } });
  });
});

describe('custom tools API', () => {
  it('creates a custom tool and lists it alongside the built-ins', async () => {
    const app = buildServer(createDb(':memory:'));
    const created = await app.inject({
      method: 'POST',
      url: '/api/tools',
      payload: { name: 'get_weather', description: 'mock weather', params: ['city'], response: '{"temp":21}' },
    });
    expect(created.statusCode).toBe(201);

    const list = await app.inject({ method: 'GET', url: '/api/tools' });
    const tools = list.json() as Array<{ name: string; custom: boolean }>;
    expect(tools.map((t) => t.name)).toContain('get_weather'); // custom
    expect(tools.map((t) => t.name)).toContain('screen_sanctions'); // built-in
    expect(tools.find((t) => t.name === 'get_weather')?.custom).toBe(true);
    await app.close();
  });

  it('rejects a name that collides with a built-in tool', async () => {
    const app = buildServer(createDb(':memory:'));
    const res = await app.inject({ method: 'POST', url: '/api/tools', payload: { name: 'screen_sanctions', description: 'x' } });
    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it('rejects an invalid tool name', async () => {
    const app = buildServer(createDb(':memory:'));
    const res = await app.inject({ method: 'POST', url: '/api/tools', payload: { name: 'Bad Name!', description: 'x' } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
