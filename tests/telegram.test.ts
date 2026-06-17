import { describe, expect, it } from 'vitest';
import { extractMessages, formatReply } from '../src/channels/telegram';

describe('extractMessages', () => {
  it('keeps text messages and drops non-text / chatless updates', () => {
    const out = extractMessages([
      { update_id: 1, message: { chat: { id: 42 }, text: '  send $400 to MX  ', from: { username: 'maria' } } },
      { update_id: 2, message: { chat: { id: 42 } } }, // no text
      { update_id: 3 }, // no message
    ]);
    expect(out).toEqual([{ updateId: 1, chatId: 42, text: 'send $400 to MX', from: 'maria' }]);
  });
});

describe('formatReply', () => {
  it('marks completed vs failed and strips the DECISION control line', () => {
    expect(formatReply('completed', 'Payout simulated.\nDECISION: complete')).toContain('✅');
    expect(formatReply('completed', 'Payout simulated.\nDECISION: complete')).not.toMatch(/DECISION/);
    expect(formatReply('failed', 'Rejected: sanctions hit')).toContain('⛔');
  });
});
