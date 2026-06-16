import { describe, expect, it } from 'vitest';
import { makeToolRegistry } from '../src/tools/registry';
import { defaultTools, makeDefaultRegistry } from '../src/tools';
import { isActionBlocked } from '../src/tools/guardrails';
import { defaultGuardrails } from '../src/domain/types';

const ctx = { agentId: 'a1' };
const guardedCtx = { agentId: 'a1', guardrails: defaultGuardrails() }; // approvalThresholdUsd = 5000
const reg = makeDefaultRegistry();
const tool = (name: string) => reg.get(name)!;

describe('tool registry', () => {
  it('exposes only the tools an agent is allowed to call', () => {
    expect(reg.forAgent(['screen_sanctions']).map((t) => t.name)).toEqual(['screen_sanctions']);
  });

  it('drops unknown tool names (least privilege)', () => {
    const scoped = reg.forAgent(['screen_sanctions', 'definitely_not_a_tool']);
    expect(scoped.map((t) => t.name)).toEqual(['screen_sanctions']);
  });

  it('returns null for an unknown tool and lists all built-ins', () => {
    const r = makeToolRegistry(defaultTools());
    expect(r.get('nope')).toBeNull();
    expect(r.all().map((t) => t.name)).toContain('initiate_payout');
  });
});

describe('screen_sanctions', () => {
  it('clears a recipient not on the blocklist', () => {
    expect((tool('screen_sanctions').handler({ name: 'Rodrigo Solano' }, ctx) as { status: string }).status).toBe('cleared');
  });
  it('flags a blocklisted recipient case-insensitively', () => {
    expect((tool('screen_sanctions').handler({ name: 'ivan SANCTIONED' }, ctx) as { status: string }).status).toBe('hit');
  });
});

describe('check_limits / get_fx_rate / quote_fees', () => {
  it('check_limits flags amounts over the regulatory cap', () => {
    expect((tool('check_limits').handler({ amountUsd: 5000 }, ctx) as { status: string }).status).toBe('within');
    expect((tool('check_limits').handler({ amountUsd: 15000 }, ctx) as { status: string }).status).toBe('over');
  });
  it('get_fx_rate returns a known rate and errors on unknown currency', () => {
    expect((tool('get_fx_rate').handler({ to: 'MXN' }, ctx) as { rate: number }).rate).toBe(17.1);
    expect(tool('get_fx_rate').handler({ to: 'XYZ' }, ctx)).toHaveProperty('error');
  });
  it('quote_fees applies 1.5% + $1.99', () => {
    expect(tool('quote_fees').handler({ amountUsd: 100 }, ctx)).toEqual({ amountUsd: 100, feeUsd: 3.49, totalUsd: 103.49 });
  });
});

describe('initiate_payout — guardrails enforced at the tool boundary', () => {
  it('simulates a payout under the approval threshold', () => {
    const out = tool('initiate_payout').handler({ amountUsd: 400, recipient: 'Rodrigo' }, guardedCtx) as {
      status: string;
      ref?: string;
    };
    expect(out.status).toBe('simulated');
    expect(typeof out.ref).toBe('string');
  });

  it('requires approval above the agent threshold (does NOT execute)', () => {
    const out = tool('initiate_payout').handler({ amountUsd: 8000, recipient: 'Rodrigo' }, guardedCtx) as {
      status: string;
      ref?: string;
    };
    expect(out.status).toBe('requires_approval');
    expect(out.ref).toBeUndefined();
  });

  it('blocks payouts over the hard regulatory cap regardless of threshold', () => {
    const out = tool('initiate_payout').handler({ amountUsd: 15000, recipient: 'Rodrigo' }, guardedCtx) as {
      status: string;
    };
    expect(out.status).toBe('blocked');
  });
});

describe('isActionBlocked (denylist)', () => {
  it('blocks a tool listed in guardrails.blockedActions', () => {
    expect(isActionBlocked('initiate_payout', { ...defaultGuardrails(), blockedActions: ['initiate_payout'] })).toBe(true);
  });
  it('allows tools not on the denylist, and tolerates missing guardrails', () => {
    expect(isActionBlocked('screen_sanctions', defaultGuardrails())).toBe(false);
    expect(isActionBlocked('anything', undefined)).toBe(false);
  });
});
