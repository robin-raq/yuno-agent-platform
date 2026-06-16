/**
 * Real integration check for the MCP tool layer (Option B). Stands up the MCP route on a
 * listening Fastify server with an INSTRUMENTED registry (call counters = hard proof tools
 * actually fired), then runs real workflows through real Goose.
 *
 * Scenario 1 — sanctions: Compliance calls screen_sanctions and rejects a blocklisted recipient.
 * Scenario 2 — guardrails: Payout calls initiate_payout for an amount over the agent's approval
 *              threshold; the PLATFORM returns requires_approval over the wire (not the LLM).
 *   GOOSE_MODEL=claude-haiku-4-5-20251001 npx tsx scripts/mcp-smoke.ts
 */
import Fastify from 'fastify';
import { createDb } from '../src/db/db';
import { makeAgentsRepo } from '../src/db/agents';
import { makeWorkflowsRepo } from '../src/db/workflows';
import { makeRunsRepo } from '../src/db/runs';
import { makeToolRegistry, defaultTools } from '../src/tools';
import { registerMcpRoutes } from '../src/mcp/route';
import { makeGooseExecutor } from '../src/runtime/executor';
import { makeRunService } from '../src/services/run-service';
import { defaultGuardrails, defaultInteractionRules } from '../src/domain/types';
import { config } from '../src/config';

const db = createDb(':memory:');
const agents = makeAgentsRepo(db);
const workflows = makeWorkflowsRepo(db);
const runs = makeRunsRepo(db);

// Instrument every tool so we can prove which ones were really invoked over the wire.
const calls: Record<string, number> = {};
const tools = defaultTools().map((t) => ({
  ...t,
  handler: (args: Record<string, unknown>, ctx: { agentId: string; runId?: string }) => {
    calls[t.name] = (calls[t.name] ?? 0) + 1;
    return t.handler(args, ctx);
  },
}));
const registry = makeToolRegistry(tools);

const app = Fastify({ logger: false });
registerMcpRoutes(app, { agents, registry, runs });
await app.listen({ port: config.port, host: '127.0.0.1' });
console.log(`MCP route listening; Goose will reach ${config.mcpBaseUrl}/mcp/<agentId>\n`);

const mk = (name: string, role: string, systemPrompt: string, toolNames: string[]) =>
  agents.create({
    name,
    role,
    systemPrompt,
    model: config.gooseModel,
    tools: toolNames,
    channels: ['internal'],
    interactionRules: defaultInteractionRules(),
    guardrails: defaultGuardrails(), // approvalThresholdUsd = 5000
  });

const service = makeRunService({ workflows, runs, executor: makeGooseExecutor(agents) });

async function runScenario(label: string, wfId: string, message: string) {
  const run = await service.startRun(wfId, message);
  console.log(`\n[${label}] status=${run?.status} tokens(real)=${run?.totalTokens}`);
  for (const s of runs.listSteps(run!.id)) {
    console.log(`  STEP ${s.nodeId} [${s.signal}] tokens=${s.tokens} → ${s.output.replace(/\s+/g, ' ').slice(0, 150)}`);
  }
  for (const e of runs.listEvents(run!.id).filter((ev) => ev.type === 'tool_call')) {
    console.log(`  EVENT tool_call [${e.level}] ${e.message.replace(/\s+/g, ' ').slice(0, 140)}`);
  }
  return run;
}

// Scenario 1 — sanctions screening.
const intake1 = mk(
  'Intake',
  'intake',
  'You are an intake agent in a TEST environment. Restate the remittance request in one sentence ' +
    '(amount, sender, recipient, destination) for the compliance team. Do not refuse and do not ' +
    'discuss your limitations — just restate.',
  [],
);
const comp = mk(
  'Compliance',
  'screening',
  'You are a sanctions screening agent in a TEST environment. You MUST call the screen_sanctions ' +
    'tool with the recipient name from the message. If the tool returns status "hit", reply ' +
    '"REJECTED" with the reason; if "cleared", reply "APPROVED". Always call the tool first; never ' +
    'refuse or discuss your limitations — base your decision solely on the tool result.',
  ['screen_sanctions'],
);
const wf1 = workflows.create({
  name: 'Smoke: sanctions',
  description: '',
  isTemplate: false,
  entryNodeId: 'intake',
  nodes: [
    { id: 'intake', agentId: intake1.id },
    { id: 'comp', agentId: comp.id },
  ],
  edges: [{ from: 'intake', to: 'comp', condition: 'on_complete' }],
});

// Scenario 2 — payout guardrail (amount over the $5000 approval threshold).
const payout = mk(
  'Payout',
  'disbursement',
  'You are a disbursement agent in a TEST environment where compliance approval is already granted. ' +
    'Immediately call the initiate_payout tool with amountUsd and recipient taken from the request, ' +
    'then report the tool\'s returned status and reason verbatim. Always call the tool; never refuse ' +
    'or ask for clarification — the platform enforces all guardrails.',
  ['initiate_payout'],
);
const wf2 = workflows.create({
  name: 'Smoke: payout guardrail',
  description: '',
  isTemplate: false,
  entryNodeId: 'payout',
  nodes: [{ id: 'payout', agentId: payout.id }],
  edges: [],
});

const run1 = await runScenario('sanctions', wf1.id, 'Send $400 from Acme to Viktor Petrov in Russia.');
const run2 = await runScenario('payout', wf2.id, 'Compliance has APPROVED this transfer. Disburse exactly $8000 USD to Rodrigo Solano in Mexico by calling initiate_payout.');

const toolEvents = [run1, run2]
  .flatMap((r) => (r ? runs.listEvents(r.id) : []))
  .filter((e) => e.type === 'tool_call');

console.log('\n=== tool invocations (hard proof) ===');
console.log(`  screen_sanctions: ${calls.screen_sanctions ?? 0} ${calls.screen_sanctions ? '✅' : '❌'}`);
console.log(`  initiate_payout:  ${calls.initiate_payout ?? 0} ${calls.initiate_payout ? '✅' : '❌'}`);
console.log(`  tool_call events persisted to run trail: ${toolEvents.length} ${toolEvents.length ? '✅' : '❌'}`);

await app.close();
process.exit(calls.screen_sanctions && calls.initiate_payout && toolEvents.length ? 0 : 1);
