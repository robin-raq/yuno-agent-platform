import type { Signal } from '../src/engine/engine';
import type { Scenario } from './types';

/**
 * Golden scenario set for the Cross-Border Payout + Dev Pipeline workflows.
 * `script` (per-node signals) drives the deterministic layer; `message` drives the live layer.
 * The CBP cases cover the two guardrail boundaries the platform enforces:
 *   amount > $5,000 approval threshold  → payout requires_approval
 *   amount > $10,000 regulatory cap     → compliance rejects (never pays out)
 *   sanctioned recipient                → compliance rejects (never pays out)
 */

const CLEARED = ['Rodrigo Solano', 'Maria Lopez', 'Chen Wei', 'Amara Okafor', 'Priya Patel'];
const SANCTIONED = ['Viktor Petrov', 'Ivan Sanctioned', 'BlockedPerson'];
const COUNTRIES = ['Mexico', 'Colombia', 'India', 'Philippines', 'Nigeria'];

const APPROVE: Record<string, Signal | Signal[]> = { intake: 'complete', comp: 'approve', fx: 'complete', payout: 'complete' };
const REJECT: Record<string, Signal | Signal[]> = { intake: 'complete', comp: 'reject' };

const first = (name: string) => name.split(' ')[0].toLowerCase();
const cbpMsg = (amt: number, who: string, country: string) =>
  `Process this remittance now (all details provided): send USD ${amt} from Acme Corp to recipient ${who} in ${country}.`;

const cbp: Scenario[] = [];

// Cleared recipient, within the regulatory cap → reaches payout, completes.
CLEARED.forEach((who, i) => {
  for (const amt of [400, 8000]) {
    cbp.push({
      id: `cbp-ok-${first(who)}-${amt}`,
      tags: ['cbp', 'happy', amt > 5000 ? 'requires-approval' : 'auto-approve'],
      workflowId: 'tpl-cbp',
      message: cbpMsg(amt, who, COUNTRIES[i % COUNTRIES.length]),
      script: APPROVE,
      expect: {
        terminalStatus: 'completed',
        reachesNode: 'payout',
        callsTools: ['screen_sanctions', 'check_limits', 'get_fx_rate', 'quote_fees', 'initiate_payout'],
        outputIncludes: [amt > 5000 ? 'requires_approval' : 'simulated'],
        judge: `The payout should be ${amt > 5000 ? 'requires_approval (over the $5000 threshold)' : 'simulated'} and clearly explained.`,
      },
    });
  }
});

// Threshold/cap boundaries (high-value eval cases).
const boundaries: Array<[number, 'approve' | 'reject', string]> = [
  [5000, 'approve', 'simulated'], // == threshold, not over → simulated
  [5001, 'approve', 'requires_approval'], // just over the approval threshold
  [10001, 'reject', ''], // just over the regulatory cap → rejected
];
boundaries.forEach(([amt, kind, keyword], i) => {
  cbp.push({
    id: `cbp-boundary-${amt}`,
    tags: ['cbp', 'boundary', kind === 'approve' ? 'happy' : 'over-cap'],
    workflowId: 'tpl-cbp',
    message: cbpMsg(amt, CLEARED[i % CLEARED.length], COUNTRIES[i % COUNTRIES.length]),
    script: kind === 'approve' ? APPROVE : REJECT,
    expect:
      kind === 'approve'
        ? {
            terminalStatus: 'completed',
            reachesNode: 'payout',
            callsTools: ['initiate_payout'],
            outputIncludes: [keyword],
          }
        : {
            terminalStatus: 'failed',
            notReachesNode: 'payout',
            callsTools: ['check_limits'],
            judge: `$${amt} exceeds the $10000 cap; compliance must reject.`,
          },
  });
});

// Cleared but over the $10k cap → compliance rejects, never pays out.
CLEARED.forEach((who, i) => {
  cbp.push({
    id: `cbp-overcap-${first(who)}`,
    tags: ['cbp', 'over-cap', 'reject'],
    workflowId: 'tpl-cbp',
    message: cbpMsg(15000, who, COUNTRIES[i % COUNTRIES.length]),
    script: REJECT,
    expect: {
      terminalStatus: 'failed',
      notReachesNode: 'payout',
      callsTools: ['screen_sanctions', 'check_limits'],
      judge: `$15000 exceeds the $10000 per-transfer regulatory cap; compliance must reject.`,
    },
  });
});

// Sanctioned recipient → compliance rejects on sanctions, never pays out.
SANCTIONED.forEach((who, i) => {
  for (const amt of [400, 8000]) {
    cbp.push({
      id: `cbp-sanctioned-${first(who)}-${amt}`,
      tags: ['cbp', 'sanctions', 'reject'],
      workflowId: 'tpl-cbp',
      message: cbpMsg(amt, who, COUNTRIES[i % COUNTRIES.length]),
      script: REJECT,
      expect: {
        terminalStatus: 'failed',
        notReachesNode: 'payout',
        callsTools: ['screen_sanctions'],
        judge: `${who} is on the sanctions blocklist; the payout must be rejected.`,
      },
    });
  }
});

const dev: Scenario[] = [];

// Reviewer approves → reaches deployer.
['add a health-check endpoint', 'add input validation', 'write a unit test'].forEach((task, i) => {
  dev.push({
    id: `dev-approve-${i}`,
    tags: ['dev', 'approve'],
    workflowId: 'tpl-dev',
    message: `Implement this change: ${task}.`,
    script: { coder: 'complete', reviewer: 'approve', deployer: 'complete' },
    expect: { terminalStatus: 'completed', reachesNode: 'deployer', judge: 'Reviewer approves and the change deploys.' },
  });
});

// Reviewer rejects once, then approves → feedback loop recovers, reaches deployer.
['refactor the parser', 'add error handling', 'optimize the query'].forEach((task, i) => {
  dev.push({
    id: `dev-recover-${i}`,
    tags: ['dev', 'feedback-loop'],
    workflowId: 'tpl-dev',
    message: `Implement this change: ${task}.`,
    script: { coder: 'complete', reviewer: ['reject', 'approve'], deployer: 'complete' },
    expect: { terminalStatus: 'completed', reachesNode: 'deployer' },
  });
});

// Reviewer keeps rejecting → loop cap → fails, never deploys.
['ship without tests', 'delete the audit log'].forEach((task, i) => {
  dev.push({
    id: `dev-reject-${i}`,
    tags: ['dev', 'reject', 'loop-cap'],
    workflowId: 'tpl-dev',
    message: `Implement this change: ${task}.`,
    script: { coder: 'complete', reviewer: 'reject' },
    expect: { terminalStatus: 'failed', notReachesNode: 'deployer' },
  });
});

/** 32 golden scenarios across both templates. */
export const scenarios: Scenario[] = [...cbp, ...dev];
