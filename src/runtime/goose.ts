import { spawn } from 'node:child_process';
import { config } from '../config';

/** Result of one headless Goose run. `output` is the agent's text with the banner stripped. */
export interface GooseResult {
  ok: boolean;
  output: string;
  raw: string;
  error?: string;
}

export interface GooseTask {
  /** The agent's identity/behavior — passed to `goose run --system`. */
  systemPrompt?: string;
  /** The task/message for the agent — passed to `goose run -t`. */
  text: string;
  model?: string;
  maxTurns?: number;
}

const READY_MARKER = 'goose is ready';

/**
 * Goose prints an ASCII banner and a "goose is ready" line before the agent's
 * actual output. Strip everything up to and including that marker.
 */
export function stripBanner(raw: string): string {
  const idx = raw.lastIndexOf(READY_MARKER);
  const body = idx >= 0 ? raw.slice(idx + READY_MARKER.length) : raw;
  return body.trim();
}

/**
 * Run a single agent task through Goose headlessly (`goose run --no-session`).
 * The provider/model/key are injected via env so nothing is configured globally.
 */
export function runGooseTask(task: GooseTask): Promise<GooseResult> {
  const args = [
    'run',
    '--no-session',
    '--max-turns',
    String(task.maxTurns ?? 6),
    '-t',
    task.text,
  ];
  if (task.systemPrompt) args.push('--system', task.systemPrompt);

  return new Promise((resolve) => {
    const child = spawn('goose', args, {
      env: {
        ...process.env,
        GOOSE_PROVIDER: config.gooseProvider,
        GOOSE_MODEL: task.model ?? config.gooseModel,
        ANTHROPIC_API_KEY: config.anthropicApiKey,
      },
    });

    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('error', (e) => resolve({ ok: false, output: '', raw: out, error: e.message }));
    child.on('close', (code) =>
      resolve({
        ok: code === 0,
        output: stripBanner(out),
        raw: out,
        error: code === 0 ? undefined : err.trim() || `goose exited ${code}`,
      }),
    );
  });
}
