import { nanoid } from 'nanoid';
import type { DB } from './db';
import type { Channel } from '../domain/types';
import type {
  EventLevel,
  EventLog,
  Message,
  MessageDirection,
  Run,
  RunStatus,
  RunStep,
  StepStatus,
} from '../domain/workflow';

interface RunRow {
  id: string;
  workflow_id: string;
  status: string;
  total_tokens: number;
  started_at: string;
  finished_at: string | null;
  pending_node_id: string | null;
  pending_message: string | null;
}
interface StepRow {
  id: string;
  run_id: string;
  node_id: string;
  agent_id: string;
  status: string;
  input: string;
  output: string;
  signal: string | null;
  tokens: number;
  started_at: string;
  finished_at: string | null;
}
interface MessageRow {
  id: string;
  run_id: string | null;
  from_agent_id: string | null;
  to_agent_id: string | null;
  channel: string;
  direction: string;
  content: string;
  created_at: string;
}
interface EventRow {
  id: string;
  run_id: string | null;
  level: string;
  type: string;
  message: string;
  created_at: string;
}

const toRun = (r: RunRow): Run => ({
  id: r.id,
  workflowId: r.workflow_id,
  status: r.status as RunStatus,
  totalTokens: r.total_tokens,
  startedAt: r.started_at,
  finishedAt: r.finished_at ?? undefined,
  pendingNodeId: r.pending_node_id ?? undefined,
  pendingMessage: r.pending_message ?? undefined,
});

const toStep = (r: StepRow): RunStep => ({
  id: r.id,
  runId: r.run_id,
  nodeId: r.node_id,
  agentId: r.agent_id,
  status: r.status as StepStatus,
  input: r.input,
  output: r.output,
  signal: r.signal ?? undefined,
  tokens: r.tokens,
  startedAt: r.started_at,
  finishedAt: r.finished_at ?? undefined,
});

const toMessage = (r: MessageRow): Message => ({
  id: r.id,
  runId: r.run_id ?? undefined,
  fromAgentId: r.from_agent_id ?? undefined,
  toAgentId: r.to_agent_id ?? undefined,
  channel: r.channel as Channel,
  direction: r.direction as MessageDirection,
  content: r.content,
  createdAt: r.created_at,
});

const toEvent = (r: EventRow): EventLog => ({
  id: r.id,
  runId: r.run_id ?? undefined,
  level: r.level as EventLevel,
  type: r.type,
  message: r.message,
  createdAt: r.created_at,
});

export function makeRunsRepo(db: DB) {
  return {
    createRun(workflowId: string): Run {
      const run: Run = {
        id: nanoid(10),
        workflowId,
        status: 'running',
        totalTokens: 0,
        startedAt: new Date().toISOString(),
      };
      db.prepare(
        `INSERT INTO runs (id,workflow_id,status,total_tokens,started_at) VALUES (?,?,?,?,?)`,
      ).run(run.id, run.workflowId, run.status, run.totalTokens, run.startedAt);
      return run;
    },

    updateRun(
      id: string,
      patch: {
        status?: RunStatus;
        totalTokens?: number;
        finishedAt?: string;
        pendingNodeId?: string | null; // null clears the pending state (on resume/finish)
        pendingMessage?: string | null;
      },
    ): void {
      const cur = this.getRun(id);
      if (!cur) return;
      const pendingNode = patch.pendingNodeId === undefined ? cur.pendingNodeId ?? null : patch.pendingNodeId;
      const pendingMsg = patch.pendingMessage === undefined ? cur.pendingMessage ?? null : patch.pendingMessage;
      db.prepare(
        'UPDATE runs SET status=?, total_tokens=?, finished_at=?, pending_node_id=?, pending_message=? WHERE id=?',
      ).run(
        patch.status ?? cur.status,
        patch.totalTokens ?? cur.totalTokens,
        patch.finishedAt ?? cur.finishedAt ?? null,
        pendingNode,
        pendingMsg,
        id,
      );
    },

    getRun(id: string): Run | null {
      const row = db.prepare('SELECT * FROM runs WHERE id = ?').get(id) as RunRow | undefined;
      return row ? toRun(row) : null;
    },

    listRuns(limit = 100): Run[] {
      const rows = db.prepare('SELECT * FROM runs ORDER BY started_at DESC LIMIT ?').all(limit) as RunRow[];
      return rows.map(toRun);
    },

    /** Insert a step in `running` state; returns its id so it can be finalized. */
    startStep(s: { runId: string; nodeId: string; agentId: string; input: string }): string {
      const id = nanoid(10);
      db.prepare(
        `INSERT INTO run_steps (id,run_id,node_id,agent_id,status,input,started_at)
         VALUES (?,?,?,?,?,?,?)`,
      ).run(id, s.runId, s.nodeId, s.agentId, 'running' as StepStatus, s.input, new Date().toISOString());
      return id;
    },

    finalizeStep(id: string, p: { status: StepStatus; output: string; signal?: string; tokens: number }): void {
      db.prepare(
        'UPDATE run_steps SET status=?, output=?, signal=?, tokens=?, finished_at=? WHERE id=?',
      ).run(p.status, p.output, p.signal ?? null, p.tokens, new Date().toISOString(), id);
    },

    listSteps(runId: string): RunStep[] {
      const rows = db.prepare('SELECT * FROM run_steps WHERE run_id = ? ORDER BY started_at').all(runId) as StepRow[];
      return rows.map(toStep);
    },

    addMessage(m: {
      runId?: string;
      fromAgentId?: string;
      toAgentId?: string;
      channel: Channel;
      direction: MessageDirection;
      content: string;
    }): Message {
      const msg: Message = { id: nanoid(10), createdAt: new Date().toISOString(), ...m };
      db.prepare(
        `INSERT INTO messages (id,run_id,from_agent_id,to_agent_id,channel,direction,content,created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
      ).run(
        msg.id,
        msg.runId ?? null,
        msg.fromAgentId ?? null,
        msg.toAgentId ?? null,
        msg.channel,
        msg.direction,
        msg.content,
        msg.createdAt,
      );
      return msg;
    },

    listMessages(runId: string): Message[] {
      const rows = db.prepare('SELECT * FROM messages WHERE run_id = ? ORDER BY created_at').all(runId) as MessageRow[];
      return rows.map(toMessage);
    },

    recentMessages(limit = 50): Message[] {
      const rows = db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT ?').all(limit) as MessageRow[];
      return rows.map(toMessage);
    },

    addEvent(e: { runId?: string; level: EventLevel; type: string; message: string }): EventLog {
      const ev: EventLog = { id: nanoid(10), createdAt: new Date().toISOString(), ...e };
      db.prepare(
        `INSERT INTO events (id,run_id,level,type,message,created_at) VALUES (?,?,?,?,?,?)`,
      ).run(ev.id, ev.runId ?? null, ev.level, ev.type, ev.message, ev.createdAt);
      return ev;
    },

    recentEvents(limit = 50): EventLog[] {
      const rows = db.prepare('SELECT * FROM events ORDER BY created_at DESC LIMIT ?').all(limit) as EventRow[];
      return rows.map(toEvent);
    },

    listEvents(runId: string): EventLog[] {
      const rows = db.prepare('SELECT * FROM events WHERE run_id = ? ORDER BY created_at').all(runId) as EventRow[];
      return rows.map(toEvent);
    },
  };
}

export type RunsRepo = ReturnType<typeof makeRunsRepo>;
