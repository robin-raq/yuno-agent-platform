import { describe, expect, it } from 'vitest';
import { stripBanner } from '../src/runtime/goose';

describe('stripBanner', () => {
  it('removes the banner up to "goose is ready"', () => {
    const raw = '\n  __( O)>  ● new session · anthropic\n   \\____)   goose is ready\nPONG\n';
    expect(stripBanner(raw)).toBe('PONG');
  });

  it('trims input that has no banner marker', () => {
    expect(stripBanner('  hello world  ')).toBe('hello world');
  });

  it('keeps only content after the last marker', () => {
    expect(stripBanner('goose is ready\nfirst\ngoose is ready\nfinal answer')).toBe('final answer');
  });
});
