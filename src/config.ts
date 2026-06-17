import dotenv from 'dotenv';

dotenv.config();

const port = Number(process.env.PORT ?? 8080);
// The MCP tool server runs on its OWN port bound to loopback only — it exposes callable tools
// (incl. the payout simulator) and must never ride the public bind. Goose (a local subprocess)
// reaches it at 127.0.0.1; nothing external can.
const mcpPort = Number(process.env.MCP_PORT ?? 8765);

/** Central runtime config. Secrets come only from the environment (.env, untracked). */
export const config = {
  port,
  mcpPort,
  dbPath: process.env.DB_PATH ?? 'data/yuno.db',

  // Base URL Goose subprocesses use to reach our loopback-only MCP tool server.
  mcpBaseUrl: process.env.MCP_BASE_URL ?? `http://127.0.0.1:${mcpPort}`,

  // Goose runtime / agent LLM provider
  gooseProvider: process.env.GOOSE_PROVIDER ?? 'anthropic',
  // Sonnet by default: haiku reliably routes/restates but breaks persona on multi-tool agent
  // roles (it refuses/confabulates instead of calling tools). Override with GOOSE_MODEL.
  gooseModel: process.env.GOOSE_MODEL ?? 'claude-sonnet-4-6',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',

  // Demo narration / optional
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',

  // External channel: Telegram
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    chatId: process.env.TELEGRAM_CHAT_ID ?? '',
    paymentProviderToken: process.env.TELEGRAM_PAYMENT_PROVIDER_TOKEN ?? '',
  },
};

/** Capability flags — let the app degrade gracefully when a credential is absent. */
export const hasGoose = (): boolean => config.anthropicApiKey.length > 0;
export const hasTelegram = (): boolean => config.telegram.botToken.length > 0;
export const hasPayments = (): boolean => config.telegram.paymentProviderToken.length > 0;
