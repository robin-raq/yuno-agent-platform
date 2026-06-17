import { config, hasTelegram } from '../config';
import type { RunService } from '../services/run-service';
import type { RunsRepo } from '../db/runs';

type FetchFn = typeof fetch;

export interface TgUpdate {
  update_id: number;
  message?: { chat?: { id: number }; text?: string; from?: { username?: string } };
}

export interface InboundMsg {
  updateId: number;
  chatId: number;
  text: string;
  from?: string;
}

/** Pull text messages out of a getUpdates batch (pure). */
export function extractMessages(updates: TgUpdate[]): InboundMsg[] {
  return updates
    .filter((u) => u.message?.text && u.message.chat?.id != null)
    .map((u) => ({
      updateId: u.update_id,
      chatId: u.message!.chat!.id,
      text: u.message!.text!.trim(),
      from: u.message!.from?.username,
    }));
}

/** Build the chat reply from a finished run (pure). */
export function formatReply(status: string | undefined, finalOutput: string): string {
  const head = status === 'completed' ? '✅ Done' : status === 'failed' ? '⛔ Rejected / not completed' : `Status: ${status ?? 'unknown'}`;
  const body = finalOutput.replace(/DECISION:.*/i, '').trim().slice(0, 600);
  return `${head}\n\n${body || '(no output)'}`;
}

async function tg(method: string, body: unknown, fetchFn: FetchFn): Promise<{ ok: boolean; result?: unknown }> {
  const res = await fetchFn(`https://api.telegram.org/bot${config.telegram.botToken}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { ok: boolean; result?: unknown };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface TelegramGatewayDeps {
  runService: RunService;
  runs: RunsRepo;
  workflowId?: string;
  fetchFn?: FetchFn;
  log?: (m: string) => void;
}

/**
 * Long-poll gateway: inbound Telegram text → run a workflow → reply in-chat. Each turn is
 * persisted as a `telegram` message (direction in/out) so the Channels screen shows the
 * conversation. No-op when no bot token is configured. Returns a stop function.
 */
export function startTelegramGateway(deps: TelegramGatewayDeps): () => void {
  if (!hasTelegram()) return () => undefined;
  const fetchFn = deps.fetchFn ?? fetch;
  const workflowId = deps.workflowId ?? 'tpl-cbp';
  const log = deps.log ?? (() => undefined);
  const allowChat = config.telegram.chatId ? Number(config.telegram.chatId) : undefined;
  let offset = 0;
  let running = true;

  void (async () => {
    log(`Telegram gateway up → workflow ${workflowId}`);
    while (running) {
      try {
        const data = await tg('getUpdates', { offset, timeout: 30 }, fetchFn);
        for (const m of extractMessages((data.result as TgUpdate[]) ?? [])) {
          offset = m.updateId + 1;
          if (allowChat && m.chatId !== allowChat) continue; // ignore other chats
          deps.runs.addMessage({ channel: 'telegram', direction: 'in', content: m.text, fromAgentId: m.from });
          const run = await deps.runService.startRun(workflowId, m.text);
          const finalOutput = run ? (deps.runs.listSteps(run.id).at(-1)?.output ?? '') : '';
          const reply = run ? formatReply(run.status, finalOutput) : '⚠️ Could not start a run.';
          await tg('sendMessage', { chat_id: m.chatId, text: reply }, fetchFn);
          deps.runs.addMessage({ runId: run?.id, channel: 'telegram', direction: 'out', content: reply });
        }
      } catch (e) {
        log(`telegram poll error: ${(e as Error).message}`);
        await sleep(2000); // back off, don't hot-loop on transient failures
      }
    }
  })();

  return () => {
    running = false;
  };
}
