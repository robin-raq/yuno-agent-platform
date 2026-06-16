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
