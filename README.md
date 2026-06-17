# Yuno Agents — AI Agent Orchestration Platform

A platform for **configuring agents, wiring them into multi-agent workflows, and running them on a
real agent runtime** — with guardrails enforced in platform code, real tool calls, evals, and a
live external channel. Built for the Yuno take-home ("AI Agent Orchestration Platform"), themed
around Yuno's domain with a **Cross-Border Payout (remittance)** workflow.

> **Status:** functional end-to-end and locally runnable with one command. No real money moves —
> payouts are simulated; Telegram payments are out of scope (pay-in deferred).

**Live demo:** _<RAILWAY_URL — added after deploy>_

---

## What it does

- **Configurable agents** — name, role, system prompt, model, tools, channels, and **guardrails**
  (approval threshold, token cap, blocked actions). Full CRUD in the UI.
- **Graph workflows** — agents wired into a directed graph that routes on each agent's signal
  (`complete` / `approve` / `reject`), with capped feedback loops and **fail-closed** gates.
- **Real execution on Goose** — every agent step runs through the [Goose](https://github.com/block/goose)
  agent runtime (Anthropic provider), with real tool-calling loops — not a mock.
- **Platform-hosted tools (MCP)** — tools live in the platform and are exposed to Goose over a
  loopback-only MCP server, **scoped per agent** (an agent's Goose process only sees its permitted
  tools). Guardrails are enforced in the tool handlers, not the prompt.
- **Human-in-the-loop approval gate** — a workflow can pause before payout (`awaiting_approval`);
  approve/reject from the Run view to resume.
- **Live Telegram channel** — message the bot; it runs the remittance workflow and replies in-chat.
- **Evaluations** — 32 golden scenarios with a deterministic layer (in CI) plus a live real-agent +
  LLM-judge layer, reporting **task-completion-rate** and **A2A-reliability** (the PRD's Key Impact
  Metrics).
- **9-screen web UI** — Dashboard, Agents, Agent Editor, Workflows, Workflow Builder (graph), Runs,
  Run View, Channels, Evaluations — all wired to the live API.

## The two seeded workflows

- **Cross-Border Payout** (`tpl-cbp`) — Intake → Compliance (`screen_sanctions`, `check_limits`) →
  FX Quote (`get_fx_rate`, `quote_fees`) → Payout (`initiate_payout`, simulated). Compliance routes
  `reject` back to Intake (capped). A **with-approval** variant (`tpl-cbp-approval`) adds a human
  gate before payout.
- **Dev Pipeline** (`tpl-dev`) — Coder → Reviewer → Deployer with a reject→retry feedback loop;
  reasoning-only, to show the engine is domain-agnostic.

## Guardrails (enforced in code, not the prompt)

The `initiate_payout` tool returns, **without moving money**:
- `blocked` when the amount exceeds the **$10,000** per-transfer regulatory cap (defense in depth),
- `requires_approval` when it exceeds the agent's **approval threshold** (default $5,000),
- `simulated` otherwise.

Sanctioned recipients are rejected at Compliance and never reach payout. `blockedActions` denies a
tool at the MCP call boundary before its handler runs.

---

## Run it locally

Prerequisites: **Node ≥ 20**, **[Goose](https://github.com/block/goose) on `PATH`**, and an
Anthropic API key.

```bash
cp .env.example .env          # then fill in ANTHROPIC_API_KEY (+ optional Telegram vars)
npm install
npm --prefix web install
npm run seed                  # seed the workflow templates + agents
npm start                     # → http://localhost:8080  (UI + API)
```

`GOOSE_MODEL` defaults to `claude-sonnet-4-6` (Sonnet reliably drives multi-tool agents; haiku is
cheaper but breaks persona on tool-using roles).

### Verify

```bash
bash scripts/verify.sh        # typecheck + tests + deterministic evals + web build
npm run eval:ci               # 32 golden scenarios (deterministic, free)  → 100% / 100%
npm run eval -- --live        # live real-agent + LLM-judge evals (costs tokens; optional)
```

---

## Architecture

```
Telegram / Web / API ─► Run Service ─► Engine (pure) ─► Executor ─► goose run (subprocess)
                                                              │  --with-streamable-http-extension
                                                              ▼
                                    MCP tool server (loopback :8765, per-agent scoped)
                                       screen_sanctions · check_limits · get_fx_rate
                                       quote_fees · initiate_payout (gated, simulated)
```

- **TypeScript** end-to-end · **Fastify** + **better-sqlite3** + **zod** (server) · **React + Vite**
  (web, served by Fastify in prod) · **Vitest** (tests) · **@modelcontextprotocol/sdk** (MCP).
- **Pure engine** (`src/engine`) — `executeWorkflow(wf, msg, executor, opts)` routes on signals,
  caps loops, pauses at gates. The executor is injected (real Goose in prod, fakes in tests), so the
  engine is fully unit-testable without an LLM.
- **MCP tool server runs loopback-only** on its own port — callable tools (incl. the payout
  simulator) are reachable by the local Goose subprocess but never from the public bind.
- **Real token usage** comes from `goose run --output-format json` (not estimated).

See [`docs/PRD-expanded.md`](docs/PRD-expanded.md) for the full spec and [`BUILD_LOG.md`](BUILD_LOG.md)
for the decision log.

---

## AI usage

Agents run on **Goose** with the **Anthropic** provider. Each workflow node composes a system prompt
(agent identity + a DECISION-line protocol constraining the routable signal), spawns `goose run` with
the agent's scoped MCP tools attached, and reads back the signal + real token usage. The LLM-judge in
the eval harness also runs through the Goose adapter. All subprocess calls use `spawn` with an argv
array (no shell), so untrusted channel input can't inject.

## Security & safety

- MCP tool surface is **loopback-only**; the public app exposes only the API + UI.
- **No real money** — payouts are simulated; Telegram payments (pay-in) are out of scope.
- Secrets come only from the environment; `.env` is gitignored and never committed.
- Guardrails are enforced at the tool boundary; gates **fail closed**.

## Tradeoffs & limitations (honest)

- **Runs are synchronous** — `POST /api/runs` blocks until the run finishes (~30–60s on real Goose).
  Live SSE streaming is **designed but not implemented**; the UI shows the final result.
- **Live evals are built but not run by default** (they cost tokens); the committed eval report is
  the deterministic layer (32/32). Run `npm run eval -- --live` to populate real-agent pass-rates.
- **Payouts and tool data are mocked/simulated** — deterministic fixtures, not real FX/sanctions
  feeds. The point is real *orchestration + tool-calling + guardrails*, not real settlement.
- **Telegram is a pay-in rail only**; disbursement stays simulated. Pay-in is deferred (no provider
  token).

## Tests

`bash scripts/verify.sh` runs the typecheck, 67 unit/integration tests, the 32-scenario deterministic
eval layer, and the web build. Real-Goose integration is exercised by `scripts/template-smoke.ts` and
`scripts/mcp-smoke.ts`.
