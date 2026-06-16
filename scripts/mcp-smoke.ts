/**
 * Real integration check for the MCP tool layer (Option B). Stands up the MCP route on a
 * listening Fastify server with an INSTRUMENTED registry (call counter = hard proof the tool
 * actually fired), then runs a real workflow through real Goose. The Compliance agent must
 * call screen_sanctions over streamable HTTP and act on the real result.
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

// Instrument screen_sanctions so we can prove it was really invoked.
let sanctionsCalls = 0;
const tools = defaultTools().map((t) =>
  t.name === 'screen_sanctions'
    ? {
        ...t,
        handler: (args: Record<string, unknown>, ctx: { agentId: string; runId?: string }) => {
          sanctionsCalls++;
          return t.handler(args, ctx);
        },
      }
    : t,
);
const registry = makeToolRegistry(tools);

const app = Fastify({ logger: false });
registerMcpRoutes(app, { agents, registry });
await app.listen({ port: config.port, host: '127.0.0.1' });
console.log(`MCP route listening; Goose will reach ${config.mcpBaseUrl}/mcp/<agentId>`);

const mk = (name: string, role: string, systemPrompt: string, toolNames: string[]) =>
  agents.create({
    name,
    role,
    systemPrompt,
    model: config.gooseModel,
    tools: toolNames,
    channels: ['internal'],
    interactionRules: defaultInteractionRules(),
    guardrails: defaultGuardrails(),
  });

const intake = mk('Intake', 'intake', 'Restate the remittance request in one sentence for the compliance team.', []);
const comp = mk(
  'Compliance',
  'screening',
  'You screen remittance recipients. Call the screen_sanctions tool with the recipient name. ' +
    'If the tool returns status "hit", state "REJECTED" and the reason. If "cleared", state "APPROVED". ' +
    'You MUST base your decision on the tool result, not your own judgement.',
  ['screen_sanctions'],
);

const wf = workflows.create({
  name: 'Smoke CBP + tools',
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
const run = await service.startRun(wf.id, 'Send $400 from Acme to Viktor Petrov in Russia.');

console.log(`\nRUN status=${run?.status} tokens(real)=${run?.totalTokens}`);
console.log(`screen_sanctions invoked: ${sanctionsCalls} time(s) ${sanctionsCalls > 0 ? '✅' : '❌'}`);
for (const s of runs.listSteps(run!.id)) {
  console.log(`  STEP ${s.nodeId} [${s.signal}] tokens=${s.tokens} → ${s.output.replace(/\s+/g, ' ').slice(0, 160)}`);
}

await app.close();
process.exit(sanctionsCalls > 0 && run?.status === 'completed' ? 0 : 1);
