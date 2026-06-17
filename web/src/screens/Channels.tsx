import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Health, Message } from '../types';
import { hhmmss } from '../ui';

const DIR_LABEL: Record<string, string> = { in: 'inbound', out: 'outbound', a2a: 'agent → agent' };

export function Channels() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    api.messages().then(setMessages).catch(() => undefined);
    api.health().then(setHealth).catch(() => undefined);
  }, []);

  const tg = health?.capabilities.telegram;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Channels</h1>
          <p>How agents talk — to each other (internal) and to the outside world (Telegram).</p>
        </div>
      </div>

      <div className="grid metrics" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 18 }}>
        <div className="card metric">
          <div className="k">internal</div>
          <div className="l">Agent-to-agent bus</div>
          <div className="d up">always on</div>
        </div>
        <div className="card metric">
          <div className="k tg">Telegram</div>
          <div className="l">External chat channel</div>
          <div className={`d ${tg ? 'up' : 'muted'}`}>{tg ? 'connected · live intake → tpl-cbp' : 'no bot token'}</div>
        </div>
      </div>

      <div className="card">
        <div className="between" style={{ marginBottom: 12 }}>
          <h3>Recent messages</h3>
          <span className="pill run"><span className="dot" /> {messages.length}</span>
        </div>
        <div className="trail">
          {messages.length === 0 && <div className="empty">No messages yet — run a workflow or message the bot.</div>}
          {messages.map((m) => (
            <div className="msg" key={m.id}>
              <span className={`pill ${m.channel === 'telegram' ? 'lime' : 'tag'}`} style={{ alignSelf: 'flex-start' }}>
                {m.channel === 'telegram' ? 'TG' : 'a2a'}
              </span>
              <div className="body">
                <div className="meta">
                  <b>{DIR_LABEL[m.direction] ?? m.direction}</b>
                  {m.fromAgentId && <span className="faint">{m.fromAgentId}</span>}
                  {m.toAgentId && <><span className="arr">→</span><span className="faint">{m.toAgentId}</span></>}
                  <span className="faint" style={{ marginLeft: 'auto' }}>{hhmmss(m.createdAt)}</span>
                </div>
                <div className="small">{m.content.slice(0, 400)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
