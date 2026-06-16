import { z } from 'zod';
import type { ToolDef } from './registry';

/**
 * Cross-Border Payout tools. All data is mocked and deterministic — the value here is that
 * the agent makes REAL tool calls through Goose's tool loop, and the platform (not the LLM)
 * decides the result. No real money moves; payouts are simulated.
 */

/** Demo sanctions blocklist. Lowercased for case-insensitive matching. */
const SANCTIONS_BLOCKLIST = ['ivan sanctioned', 'viktor petrov', 'blockedperson'];

const screenSanctions: ToolDef = {
  name: 'screen_sanctions',
  description:
    'Screen a payout recipient against the sanctions blocklist before sending funds. ' +
    'Returns {status:"cleared"|"hit", reason}. A "hit" means the payout must be rejected.',
  inputSchema: {
    name: z.string().describe('Full name of the payout recipient'),
    country: z.string().optional().describe('Destination country'),
  },
  handler: (args) => {
    const name = String(args.name ?? '').trim();
    const country = args.country ? String(args.country) : undefined;
    const hit = SANCTIONS_BLOCKLIST.includes(name.toLowerCase());
    return hit
      ? { status: 'hit', reason: `${name} matches a sanctions blocklist entry`, country }
      : { status: 'cleared', reason: `no sanctions match for ${name}`, country };
  },
};

/** All remittance-domain tools. Pure data — registration happens in tools/index.ts. */
export const remittanceTools: ToolDef[] = [screenSanctions];
