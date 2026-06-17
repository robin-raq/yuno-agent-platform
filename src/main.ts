import { buildServer } from './server';
import { buildMcpApp } from './mcp/server';
import { getDb } from './db/db';
import { makeAgentsRepo } from './db/agents';
import { makeWorkflowsRepo } from './db/workflows';
import { makeRunsRepo } from './db/runs';
import { makeCustomToolsRepo } from './db/custom-tools';
import { makeGooseExecutor } from './runtime/executor';
import { makeRunService } from './services/run-service';
import { startTelegramGateway } from './channels/telegram';
import { seedTemplates } from './db/seed';
import { config, hasGoose, hasTelegram } from './config';

const db = getDb();
seedTemplates(db); // idempotent — ensures the two workflow templates exist on boot

const agents = makeAgentsRepo(db);
const runs = makeRunsRepo(db);
const runService = makeRunService({ workflows: makeWorkflowsRepo(db), runs, executor: makeGooseExecutor(agents) });

const app = buildServer(db);
const mcp = buildMcpApp({ agents, customTools: makeCustomToolsRepo(db), runs });

try {
  // MCP tool server: loopback only, so callable tools are reachable by the local Goose
  // subprocess but never from outside the host.
  await mcp.listen({ port: config.mcpPort, host: '127.0.0.1' });
  const addr = await app.listen({ port: config.port, host: '0.0.0.0' });
  // eslint-disable-next-line no-console
  console.log(`Yuno Agents listening on ${addr}  (MCP tools on 127.0.0.1:${config.mcpPort})`);
  // eslint-disable-next-line no-console
  console.log(`  goose=${hasGoose()} telegram=${hasTelegram()}`);
  // Live Telegram intake → runs the remittance workflow → replies in-chat. No-op without a token.
  startTelegramGateway({ runService, runs, log: (m) => console.log(`[telegram] ${m}`) });
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
}
