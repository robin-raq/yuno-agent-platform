import dotenv from 'dotenv';

dotenv.config();

/** Central runtime config. Secrets come only from the environment (.env, untracked). */
export const config = {
  port: Number(process.env.PORT ?? 8080),
  dbPath: process.env.DB_PATH ?? 'data/yuno.db',

  // Goose runtime / agent LLM provider
  gooseProvider: process.env.GOOSE_PROVIDER ?? 'anthropic',
  gooseModel: process.env.GOOSE_MODEL ?? 'claude-haiku-4-5-20251001',
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
