import { describe, expect, it } from 'vitest';
import { buildGooseArgs, parseGooseJson } from '../src/runtime/goose';

describe('buildGooseArgs', () => {
  it('builds a minimal headless run', () => {
    const args = buildGooseArgs({ text: 'hi' });
    expect(args).toEqual(['run', '--no-session', '--max-turns', '6', '-t', 'hi']);
  });

  it('attaches MCP extensions and JSON output when requested', () => {
    const args = buildGooseArgs({
      text: 'do it',
      systemPrompt: 'be helpful',
      extensions: ['http://127.0.0.1:8080/mcp/a1'],
      jsonOutput: true,
    });
    expect(args).toContain('--system');
    expect(args).toContain('--with-streamable-http-extension');
    expect(args).toContain('http://127.0.0.1:8080/mcp/a1');
    expect(args.slice(-3)).toEqual(['--output-format', 'json', '--quiet']);
  });
});

describe('parseGooseJson', () => {
  const envelope = JSON.stringify({
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'q' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'final answer' }] },
    ],
    metadata: { total_tokens: 7423, input_tokens: 7419, output_tokens: 4, status: 'completed' },
  });

  it('extracts the final assistant text and real usage', () => {
    const { text, usage } = parseGooseJson(envelope);
    expect(text).toBe('final answer');
    expect(usage).toEqual({ totalTokens: 7423, inputTokens: 7419, outputTokens: 4 });
  });

  it('falls back to banner-stripped text on non-JSON output', () => {
    const { text, usage } = parseGooseJson('goose is ready\nplain text reply');
    expect(text).toBe('plain text reply');
    expect(usage).toBeUndefined();
  });
});
