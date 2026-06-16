import { describe, expect, it } from 'vitest';
import { clampSignal, estimateTokens, parseSignal, stripDecision, toolEndpoint } from '../src/runtime/executor';

describe('parseSignal', () => {
  it('reads the DECISION line case-insensitively', () => {
    expect(parseSignal('did the screening\nDECISION: approve')).toBe('approve');
    expect(parseSignal('DECISION: Reject')).toBe('reject');
    expect(parseSignal('DECISION: complete')).toBe('complete');
  });

  it('defaults to complete when no decision is present', () => {
    expect(parseSignal('just some text')).toBe('complete');
  });
});

describe('stripDecision', () => {
  it('removes the control line from human-facing text', () => {
    expect(stripDecision('recipient cleared\nDECISION: approve')).toBe('recipient cleared');
  });
});

describe('estimateTokens', () => {
  it('approximates chars/4 and is non-negative', () => {
    expect(estimateTokens('abcd', 'efgh')).toBe(2);
    expect(estimateTokens('', '')).toBe(0);
  });
});

describe('clampSignal', () => {
  it('passes through a signal that is in the routable set', () => {
    expect(clampSignal('reject', ['approve', 'reject'])).toBe('reject');
  });
  it('falls back to complete when available and the signal is off-set', () => {
    expect(clampSignal('approve', ['complete'])).toBe('complete');
  });
  it('fails CLOSED on an approval gate — defaults to reject, never approve', () => {
    expect(clampSignal('complete', ['approve', 'reject'])).toBe('reject');
  });
});

describe('toolEndpoint', () => {
  it('scopes the URL to the agent and appends the run id for correlation', () => {
    expect(toolEndpoint('a1')).toMatch(/\/mcp\/a1$/);
    expect(toolEndpoint('a1', 'run-9')).toMatch(/\/mcp\/a1\?runId=run-9$/);
  });
});
