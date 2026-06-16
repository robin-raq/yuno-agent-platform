import { describe, expect, it } from 'vitest';
import { estimateTokens, parseSignal, stripDecision } from '../src/runtime/executor';

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
