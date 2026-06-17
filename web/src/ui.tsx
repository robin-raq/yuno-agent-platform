import type { EventLog } from './types';

export const hhmmss = (iso: string) => new Date(iso).toLocaleTimeString([], { hour12: false });
export const shortId = (id: string) => id.slice(0, 8);
export const initials = (name: string) =>
  name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

/** Tool-call events get the lime "tool" dot; everything else uses its log level. */
export const eventLevelClass = (e: Pick<EventLog, 'type' | 'level'>) =>
  e.type === 'tool_call' ? 'tool' : e.level;

const RUN_STATUS: Record<string, string> = {
  completed: 'ok',
  failed: 'fail',
  awaiting_approval: 'wait',
  running: 'run',
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`pill ${RUN_STATUS[status] ?? 'idle'}`}>
      <span className="dot" />
      {status.replace('_', ' ')}
    </span>
  );
}

const SIGNAL_CLASS: Record<string, string> = { approve: 'ok', reject: 'fail', complete: 'run' };

export function SignalPill({ signal }: { signal?: string }) {
  return (
    <span className={`pill ${signal ? SIGNAL_CLASS[signal] ?? 'idle' : 'idle'}`}>
      <span className="dot" />
      {signal ?? '—'}
    </span>
  );
}
