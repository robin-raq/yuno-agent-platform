import { z } from 'zod';
import { nanoid } from 'nanoid';
import type { ToolDef } from './registry';

/**
 * Cross-Border Payout tools. All data is mocked and deterministic — the value here is that
 * the agent makes REAL tool calls through Goose's tool loop, and the PLATFORM (not the LLM)
 * decides the result and enforces guardrails. No real money moves; payouts are simulated.
 */

/** Demo sanctions blocklist. Lowercased for case-insensitive matching. */
const SANCTIONS_BLOCKLIST = ['ivan sanctioned', 'viktor petrov', 'blockedperson'];

/** Demo FX table (USD → destination currency). Mock, deterministic. */
const FX_RATES: Record<string, number> = {
  MXN: 17.1,
  COP: 4100,
  INR: 83.2,
  PHP: 56.5,
  NGN: 1480,
  BRL: 5.05,
  EUR: 0.92,
};

/** Hard per-transfer regulatory ceiling (USD). Distinct from an agent's approval threshold. */
const TRANSFER_CAP_USD = 10000;

const round2 = (n: number): number => Math.round(n * 100) / 100;

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

const checkLimits: ToolDef = {
  name: 'check_limits',
  description:
    `Check a payout amount against the $${TRANSFER_CAP_USD} per-transfer regulatory cap. ` +
    'Returns {status:"within"|"over", cap, amountUsd}.',
  inputSchema: {
    amountUsd: z.number().describe('Payout amount in USD'),
    corridor: z.string().optional().describe('Corridor, e.g. US-MX'),
  },
  handler: (args) => {
    const amountUsd = Number(args.amountUsd);
    return amountUsd > TRANSFER_CAP_USD
      ? { status: 'over', cap: TRANSFER_CAP_USD, amountUsd }
      : { status: 'within', cap: TRANSFER_CAP_USD, amountUsd };
  },
};

const getFxRate: ToolDef = {
  name: 'get_fx_rate',
  description:
    'Get the FX rate to convert USD into a destination currency. ' +
    'Returns {from,to,rate,asOf} or {error} if the currency is unsupported.',
  inputSchema: {
    to: z.string().describe('Destination currency code, e.g. MXN'),
    from: z.string().optional().describe('Source currency (defaults to USD)'),
  },
  handler: (args) => {
    const to = String(args.to ?? '').toUpperCase();
    const from = String(args.from ?? 'USD').toUpperCase();
    const rate = FX_RATES[to];
    return rate ? { from, to, rate, asOf: '2026-06-16' } : { error: `no FX rate available for ${to}` };
  },
};

const quoteFees: ToolDef = {
  name: 'quote_fees',
  description:
    'Quote the transfer fee for a payout (1.5% + $1.99 flat). Returns {amountUsd,feeUsd,totalUsd}.',
  inputSchema: {
    amountUsd: z.number().describe('Payout amount in USD'),
    corridor: z.string().optional().describe('Corridor, e.g. US-MX'),
  },
  handler: (args) => {
    const amountUsd = Number(args.amountUsd);
    const feeUsd = round2(amountUsd * 0.015 + 1.99);
    return { amountUsd, feeUsd, totalUsd: round2(amountUsd + feeUsd) };
  },
};

const initiatePayout: ToolDef = {
  name: 'initiate_payout',
  description:
    'Initiate a cross-border payout. SIMULATED — no real funds move. Returns ' +
    '{status:"simulated"|"requires_approval"|"blocked", ref?, reason}. Amounts over the ' +
    'regulatory cap are blocked; amounts over the agent approval threshold require approval ' +
    'and are NOT executed.',
  inputSchema: {
    amountUsd: z.number().describe('Payout amount in USD'),
    recipient: z.string().describe('Recipient name'),
    country: z.string().optional().describe('Destination country'),
  },
  handler: (args, ctx) => {
    const amountUsd = Number(args.amountUsd);
    const recipient = String(args.recipient ?? '');

    // Defense in depth: enforce the hard regulatory cap regardless of what the agent checked.
    if (amountUsd > TRANSFER_CAP_USD) {
      return {
        status: 'blocked',
        reason: `payout of $${amountUsd} exceeds the $${TRANSFER_CAP_USD} regulatory cap`,
        amountUsd,
        recipient,
      };
    }

    // Value gate: the platform — not the LLM — holds back payouts above the approval threshold.
    const threshold = ctx.guardrails?.approvalThresholdUsd;
    if (typeof threshold === 'number' && amountUsd > threshold) {
      return {
        status: 'requires_approval',
        reason: `payout of $${amountUsd} exceeds the $${threshold} approval threshold`,
        amountUsd,
        recipient,
      };
    }

    return {
      status: 'simulated',
      ref: `PO-${nanoid(8)}`,
      amountUsd,
      recipient,
      reason: 'payout simulated — no real funds moved',
    };
  },
};

/** All remittance-domain tools. Pure data — registration happens in tools/index.ts. */
export const remittanceTools: ToolDef[] = [
  screenSanctions,
  checkLimits,
  getFxRate,
  quoteFees,
  initiatePayout,
];
