/**
 * Manual integration check: seed two agents + a workflow and execute it through the
 * REAL Goose runtime (not the fake executor used in unit tests).
 *   GOOSE_MODEL=claude-haiku-4-5-20251001 npx tsx scripts/smoke-run.ts
 */
import { createDb } from '../src/db/db';
import { makeAgentsRepo } from '../src/db/agents';
import { makeWorkflowsRepo } from '../src/db/workflows';
import { makeRunsRepo } from '../src/db/runs';
import { makeGooseExecutor } from '../src/runtime/executor';
import { makeRunService } from '../src/services/run-service';
import { defaultGuardrails, defaultInteractionRules } from '../src/domain/types';
import { config } from '../src/config';

const db = createDb(':memory:');
const agents = makeAgentsRepo(db);
const workflows = makeWorkflowsRepo(db);
const runs = makeRunsRepo(db);

const mk = (name: string, role: string, systemPrompt: string) =>
  agents.create({
    name,
    role,
    systemPrompt,
    model: config.gooseModel,
    tools: [],
    channels: ['internal'],
    interactionRules: defaultInteractionRules(),
    guardrails: defaultGuardrails(),
  });

const intake = mk('Intake', 'intake', 'Restate the remittance request concisely for the compliance team in one sentence.');
const comp = mk(
  'Compliance',
  'screening',
  'You are a sanctions screening officer. Blocklist: [Ivan Sanctioned, BlockedPerson]. If the recipient is on the blocklist, reject with a brief reason; otherwise approve.',
);

const wf = workflows.create({
  name: 'Smoke CBP',
  description: '',
  isTemplate: false,
  entryNodeId: 'intake',
  nodes: [
    { id: 'intake', agentId: intake.id },
    { id: 'comp', agentId: comp.id },
  ],
  edges: [{ from: 'intake', to: 'comp', condition: 'on_complete' }],
});

const service = makeRunService({ workflows, runs, executor: makeGooseExecutor(agents) });
const run = await service.startRun(wf.id, 'Send $400 from Acme to Rodrigo Solano in Mexico.');

console.log(`\nRUN status=${run?.status} tokens(est)=${run?.totalTokens}`);
for (const s of runs.listSteps(run!.id)) {
  console.log(`  STEP ${s.nodeId} [${s.signal}] → ${s.output.replace(/\s+/g, ' ').slice(0, 140)}`);
}
for (const m of runs.listMessages(run!.id)) {
  console.log(`  MSG  ${m.fromAgentId}→${m.toAgentId}: ${m.content.replace(/\s+/g, ' ').slice(0, 100)}`);
}
