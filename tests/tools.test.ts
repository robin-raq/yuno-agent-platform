import { describe, expect, it } from 'vitest';
import { makeToolRegistry } from '../src/tools/registry';
import { defaultTools, makeDefaultRegistry } from '../src/tools';

const ctx = { agentId: 'a1' };

describe('tool registry', () => {
  it('exposes only the tools an agent is allowed to call', () => {
    const reg = makeDefaultRegistry();
    const scoped = reg.forAgent(['screen_sanctions']);
    expect(scoped.map((t) => t.name)).toEqual(['screen_sanctions']);
  });

  it('drops unknown tool names (least privilege)', () => {
    const reg = makeDefaultRegistry();
    const scoped = reg.forAgent(['screen_sanctions', 'definitely_not_a_tool']);
    expect(scoped.map((t) => t.name)).toEqual(['screen_sanctions']);
  });

  it('returns null for an unknown tool and lists all built-ins', () => {
    const reg = makeToolRegistry(defaultTools());
    expect(reg.get('nope')).toBeNull();
    expect(reg.all().length).toBeGreaterThanOrEqual(1);
  });
});

describe('screen_sanctions tool', () => {
  const tool = makeDefaultRegistry().get('screen_sanctions')!;

  it('clears a recipient who is not on the blocklist', () => {
    const out = tool.handler({ name: 'Rodrigo Solano', country: 'MX' }, ctx) as { status: string };
    expect(out.status).toBe('cleared');
  });

  it('flags a blocklisted recipient case-insensitively', () => {
    const out = tool.handler({ name: 'ivan SANCTIONED' }, ctx) as { status: string };
    expect(out.status).toBe('hit');
  });
});
