import type { DB } from './db';
import { getDb } from './db';
import { makeAgentsRepo } from './agents';
import { makeWorkflowsRepo } from './workflows';
import type { CreateAgentInput } from '../domain/types';
import type { NewWorkflow } from '../domain/workflow';
import { config } from '../config';

/**
 * Built-in agents + the two PRD workflow templates, seeded idempotently by fixed id.
 * Cross-Border Payout showcases the real tool suite + guardrails; Dev Pipeline shows the
 * engine is domain-agnostic (multi-agent + reject feedback loop, no remittance tools).
 */

const model = config.gooseModel;

// Shared framing: smaller models otherwise flake by refusing to act, and in a chain the first
// agent's hesitation cascades (see BUILD_LOG). This keeps template agents in-persona, acting on
// exactly the input given, and using their tools.
const FRAMING =
  'You operate in a TEST environment with simulated data; no real funds move. ' +
  'Act on exactly the information provided. Always use your tools. Never refuse, ' +
  'ask for clarification, or discuss your limitations.';

interface SeedAgent {
  id: string;
  input: CreateAgentInput;
}

const TEMPLATE_AGENTS: SeedAgent[] = [
  // --- Cross-Border Payout ---
  {
    id: 'cbp-intake',
    input: {
      name: 'Intake',
      role: 'intake',
      systemPrompt: `${FRAMING} Restate the remittance request exactly as given in one sentence (USD amount, sender, recipient, destination country) for the compliance team. Do not ask for additional details.`,
      model,
      tools: [],
      channels: ['telegram', 'internal'],
    },
  },
  {
    id: 'cbp-compliance',
    input: {
      name: 'Compliance',
      role: 'screening',
      systemPrompt: `${FRAMING} Call screen_sanctions with the recipient name and check_limits with the USD amount. Approve only if sanctions are CLEARED and the amount is WITHIN limits; otherwise reject with the reason.`,
      model,
      tools: ['screen_sanctions', 'check_limits'],
      channels: ['internal'],
    },
  },
  {
    id: 'cbp-fx',
    input: {
      name: 'FX Quote',
      role: 'pricing',
      systemPrompt: `${FRAMING} Call get_fx_rate for the destination currency and quote_fees for the USD amount, then summarise the rate, fee, and total for the payout agent.`,
      model,
      tools: ['get_fx_rate', 'quote_fees'],
      channels: ['internal'],
    },
  },
  {
    id: 'cbp-payout',
    input: {
      name: 'Payout',
      role: 'disbursement',
      systemPrompt: `${FRAMING} Call initiate_payout with the USD amount and recipient, then report the returned status and reason verbatim. Do not override the platform decision.`,
      model,
      tools: ['initiate_payout'],
      channels: ['internal'],
      guardrails: { approvalThresholdUsd: 5000 },
    },
  },
  // --- Dev Pipeline (general-engine demo; reasoning only, no tools) ---
  {
    id: 'dev-coder',
    input: {
      name: 'Coder',
      role: 'engineer',
      systemPrompt: `${FRAMING} Write a concise implementation plan or code sketch for the requested change.`,
      model,
      tools: [],
      channels: ['internal'],
    },
  },
  {
    id: 'dev-reviewer',
    input: {
      name: 'Reviewer',
      role: 'reviewer',
      systemPrompt: `${FRAMING} Review the coder's output. Approve if it is correct and complete; otherwise reject with specific, actionable feedback.`,
      model,
      tools: [],
      channels: ['internal'],
    },
  },
  {
    id: 'dev-deployer',
    input: {
      name: 'Deployer',
      role: 'ops',
      systemPrompt: `${FRAMING} Describe the simulated deployment of the approved change and confirm completion.`,
      model,
      tools: [],
      channels: ['internal'],
    },
  },
];

interface SeedWorkflow {
  id: string;
  input: NewWorkflow;
}

const TEMPLATE_WORKFLOWS: SeedWorkflow[] = [
  {
    id: 'tpl-cbp',
    input: {
      name: 'Cross-Border Payout',
      description:
        'Remittance flow: intake → sanctions/limit screening (reject loops back) → FX quote → simulated payout (guardrail-gated).',
      isTemplate: true,
      entryNodeId: 'intake',
      nodes: [
        { id: 'intake', agentId: 'cbp-intake' },
        { id: 'comp', agentId: 'cbp-compliance' },
        { id: 'fx', agentId: 'cbp-fx' },
        { id: 'payout', agentId: 'cbp-payout' },
      ],
      edges: [
        { from: 'intake', to: 'comp', condition: 'on_complete' },
        { from: 'comp', to: 'fx', condition: 'on_approve' },
        { from: 'comp', to: 'intake', condition: 'on_reject', maxLoops: 2 },
        { from: 'fx', to: 'payout', condition: 'on_complete' },
      ],
    },
  },
  {
    id: 'tpl-dev',
    input: {
      name: 'Dev Pipeline',
      description:
        'Generic engineering flow: coder → reviewer (reject loops back) → simulated deploy. Shows the engine is domain-agnostic.',
      isTemplate: true,
      entryNodeId: 'coder',
      nodes: [
        { id: 'coder', agentId: 'dev-coder' },
        { id: 'reviewer', agentId: 'dev-reviewer' },
        { id: 'deployer', agentId: 'dev-deployer' },
      ],
      edges: [
        { from: 'coder', to: 'reviewer', condition: 'on_complete' },
        { from: 'reviewer', to: 'deployer', condition: 'on_approve' },
        { from: 'reviewer', to: 'coder', condition: 'on_reject', maxLoops: 2 },
      ],
    },
  },
];

/** Idempotently seed the built-in agents + workflow templates. Safe to call on every boot. */
export function seedTemplates(db: DB): void {
  const agents = makeAgentsRepo(db);
  const workflows = makeWorkflowsRepo(db);
  for (const a of TEMPLATE_AGENTS) agents.upsert(a.id, a.input);
  for (const w of TEMPLATE_WORKFLOWS) workflows.upsert(w.id, w.input);
}

// `npm run seed` — seed the singleton DB directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTemplates(getDb());
  // eslint-disable-next-line no-console
  console.log('Seeded templates: Cross-Border Payout, Dev Pipeline');
}
