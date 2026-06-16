/**
 * Real end-to-end check that the seeded Cross-Border Payout template runs through real Goose,
 * exercising the full tool suite across four agents:
 *   Intake → Compliance (screen_sanctions, check_limits) → FX (get_fx_rate, quote_fees)
 *          → Payout (initiate_payout, guardrail-gated)
 *   GOOSE_MODEL=claude-haiku-4-5-20251001 npx tsx scripts/template-smoke.ts
 */
import Fastify from 'fastify';
import { createDb } from '../src/db/db';
import { makeAgentsRepo } from '../src/db/agents';
import { makeWorkflowsRepo } from '../src/db/workflows';
import { makeRunsRepo } from '../src/db/runs';
import { seedTemplates } from '../src/db/seed';
import { makeToolRegistry, defaultTools } from '../src/tools';
import { registerMcpRoutes } from '../src/mcp/route';
import { makeGooseExecutor } from '../src/runtime/executor';
import { makeRunService } from '../src/services/run-service';
import { config } from '../src/config';

const db = createDb(':memory:');
seedTemplates(db);
const agents = makeAgentsRepo(db);
const workflows = makeWorkflowsRepo(db);
const runs = makeRunsRepo(db);

// Instrument every tool to prove which ones really fired over the wire.
const calls: Record<string, number> = {};
const tools = defaultTools().map((t) => ({
  ...t,
  handler: (args: Record<string, unknown>, ctx: { agentId: string; runId?: string }) => {
    calls[t.name] = (calls[t.name] ?? 0) + 1;
    return t.handler(args, ctx);
  },
}));

const app = Fastify({ logger: false });
registerMcpRoutes(app, { agents, registry: makeToolRegistry(tools), runs });
await app.listen({ port: config.port, host: '127.0.0.1' });
console.log(`MCP route listening; running template "Cross-Border Payout" (tpl-cbp)\n`);

const service = makeRunService({ workflows, runs, executor: makeGooseExecutor(agents) });
const run = await service.startRun(
  'tpl-cbp',
  'Process this remittance now (all details provided): send USD 8000 from Acme Corp to recipient Rodrigo Solano in Mexico.',
);

console.log(`RUN status=${run?.status} tokens(real)=${run?.totalTokens}`);
for (const s of runs.listSteps(run!.id)) {
  console.log(`  STEP ${s.nodeId} [${s.signal}] tokens=${s.tokens} → ${s.output.replace(/\s+/g, ' ').slice(0, 130)}`);
}
for (const e of runs.listEvents(run!.id).filter((ev) => ev.type === 'tool_call')) {
  console.log(`  TOOL [${e.level}] ${e.message.replace(/\s+/g, ' ').slice(0, 130)}`);
}

const expected = ['screen_sanctions', 'check_limits', 'get_fx_rate', 'quote_fees', 'initiate_payout'];
console.log('\n=== tool coverage (hard proof) ===');
for (const name of expected) console.log(`  ${name}: ${calls[name] ?? 0} ${calls[name] ? '✅' : '❌'}`);

await app.close();
const allFired = expected.every((n) => calls[n]);
process.exit(allFired && run?.status === 'completed' ? 0 : 1);
