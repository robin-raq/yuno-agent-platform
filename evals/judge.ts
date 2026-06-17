import { runGooseTask } from '../src/runtime/goose';
import type { Verdict } from './types';

const VERDICT_RE = /VERDICT:\s*(pass|fail)/i;

/** Parse the judge's reply into a verdict. Defaults to fail if no verdict line is present. */
export function parseVerdict(raw: string): Verdict {
  const m = raw.match(VERDICT_RE);
  const reason = raw.replace(VERDICT_RE, '').replace(/\s+/g, ' ').trim().slice(0, 200);
  return { pass: m?.[1]?.toLowerCase() === 'pass', reason: reason || '(no reason given)' };
}

/**
 * LLM-judge for the live layer: score an agent transcript against a rubric. Runs through the
 * existing Goose adapter (no new dependency); judging is qualitative and complements the
 * deterministic checks.
 */
export async function judge(rubric: string, transcript: string): Promise<Verdict> {
  const systemPrompt =
    'You are an eval judge for an AI agent platform. Given a RUBRIC and an agent TRANSCRIPT, ' +
    'decide whether the transcript satisfies the rubric. Reply with a one-line reason, then a ' +
    'final line exactly "VERDICT: pass" or "VERDICT: fail".';
  const res = await runGooseTask({
    systemPrompt,
    text: `RUBRIC:\n${rubric}\n\nTRANSCRIPT:\n${transcript}`,
    jsonOutput: true,
    maxTurns: 1,
  });
  return parseVerdict(res.ok ? res.output : `VERDICT: fail — judge error: ${res.error}`);
}
