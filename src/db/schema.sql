-- Yuno Agent Platform schema. JSON-shaped columns store sub-objects (tools, rules, etc.)
-- to keep the demo schema small; repositories serialize/parse at the boundary.

CREATE TABLE IF NOT EXISTS agents (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  role              TEXT NOT NULL,
  system_prompt     TEXT NOT NULL,
  model             TEXT NOT NULL,
  tools             TEXT NOT NULL DEFAULT '[]',
  channels          TEXT NOT NULL DEFAULT '[]',
  interaction_rules TEXT NOT NULL DEFAULT '{}',
  guardrails        TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflows (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  is_template   INTEGER NOT NULL DEFAULT 0,
  entry_node_id TEXT NOT NULL,
  nodes         TEXT NOT NULL DEFAULT '[]',
  edges         TEXT NOT NULL DEFAULT '[]',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id           TEXT PRIMARY KEY,
  workflow_id  TEXT NOT NULL,
  status       TEXT NOT NULL,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  started_at   TEXT NOT NULL,
  finished_at  TEXT
);

CREATE TABLE IF NOT EXISTS run_steps (
  id          TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL,
  node_id     TEXT NOT NULL,
  agent_id    TEXT NOT NULL,
  status      TEXT NOT NULL,
  input       TEXT NOT NULL DEFAULT '',
  output      TEXT NOT NULL DEFAULT '',
  signal      TEXT,
  tokens      INTEGER NOT NULL DEFAULT 0,
  started_at  TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id            TEXT PRIMARY KEY,
  run_id        TEXT,
  from_agent_id TEXT,
  to_agent_id   TEXT,
  channel       TEXT NOT NULL,
  direction     TEXT NOT NULL,
  content       TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id         TEXT PRIMARY KEY,
  run_id     TEXT,
  level      TEXT NOT NULL,
  type       TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL
);
