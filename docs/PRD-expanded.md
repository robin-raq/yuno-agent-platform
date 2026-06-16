# Yuno Agent Orchestration Platform — Expanded PRD

> Source of truth: `project_yuno.pdf`. This document adds engineering substance so the
> build has no ambiguity about *what* to build. Where this doc and the PRD disagree,
> the PRD wins.

## Original brief (condensed, faithful)

Build a platform where users can **create AI agents**, configure how they behave
(personality, tools, schedules, memory, limits), and **connect them into collaborative
workflows**. Agents must run on a **real runtime**, execute **real tools**, and
**communicate asynchronously** to complete tasks autonomously. **At least one agent must
be reachable through an external messaging channel** (WhatsApp/Telegram/Slack) for a real
human conversation. A **web UI** manages everything visually. Persistence is required
(agent configs, memory, workflow state, execution history). **Real-time** frontend↔backend
(WebSocket or SSE). Must **run fully local with a single setup command**; cloud optional.

Must-haves: Agent CRUD; per-agent config (schedules, memory, skills, interaction rules,
guardrails); a visual workflow builder with **configurable** execution order, conditions,
and **feedback loops**; **≥2 workflow templates**; external channel integration; live
monitoring (status, logs, inter-agent messages, progress, token/cost). The chosen runtime
**must actually execute agent logic — not a UI mockup**. Grading: 40% working demo / 30%
architecture & code quality / 20% UI/UX & configurability / 10% docs.

**Locked decisions (intake):** runtime = **Goose** (native Anthropic provider); channel =
**Telegram**; deploy = **Railway** + fully-local one-command run.

## Problem & users

- **Who:** an operator at a global enterprise (the demo audience is Yuno, a payments
  orchestrator) who needs autonomous agents to run multi-step back-office processes and to
  be reachable by humans over chat.
- **Job:** define agents once, wire them into a workflow with review/approval/feedback
  loops, and watch them execute a real task end-to-end — with a human able to kick one off
  and intervene from Telegram.
- **Single most important flow:** load a workflow template → run it → agents exchange
  messages and call tools → an approval gate pauses for a human → approve → it completes,
  all visible live; **and** a human chats the same workflow's entry agent on Telegram.

## Scope

**In scope (demo):**
- Agent CRUD with the full configurable-dimensions set (identity, tools, channels,
  schedules, memory, skills, interaction rules, guardrails).
- Visual workflow builder: nodes = agents, edges = conditional transitions
  (`on_complete` / `on_approve` / `on_reject`→feedback). Order, conditions, and loops are
  data, not code.
- **2 workflow templates**, both showing a feedback loop:
  1. **Cross-Border Payout** (Yuno-themed remittance pipeline) — also shows an **approval
     gate**, **Telegram intake**, and a **Telegram Payments pay-in** (Stripe TEST mode).
  2. **Dev Pipeline** (the PRD's Coder→Reviewer→Deployer example).
- Real execution via **Goose** (real tool loop, real token usage).
- **Telegram** channel: a human messages the bound agent and gets a real, config-driven
  reply; logged and counted in monitoring.
- **Telegram Payments pay-in (TEST mode):** the sender funds the transfer via an in-chat
  `sendInvoice` using a Stripe **test** provider token; the bot handles `pre_checkout_query`
  + `successful_payment`. No real money moves (test cards only). The cross-border **payout
  stays simulated** — Telegram is a pay-in rail, not a disbursement rail.
- Live monitoring over **SSE**: agent status, logs, inter-agent message trail, run
  progress, per-step + total token/cost.
- **SQLite** persistence of every entity below.
- Tests for the critical paths: agent creation, workflow execution, message delivery.
- **Eval harness:** ~10 golden scenarios replayed through the *real* engine + a scorer
  (deterministic checks + a small LLM-judge), computing **task completion rate** and
  **agent-to-agent message reliability** (two of the PRD's Key Impact Metrics). Wired into `verify.sh`.
- **Evaluations screen + A/B experiments:** a UI to view the scorecard and compare two agent/
  workflow configs on the same scenario set — Yuno's experimentation pattern applied to agents.
- One-command local run; Railway deployment for a public URL.

**Explicitly out of scope (prevents phantom features):**
- Real money movement — **payouts are simulated** and all pay-in runs in Stripe **TEST** mode
  (test cards only; no real funds, no real disbursement rail).
- Real KYC/AML/sanctions vendor — **mocked static denylist**, clearly labeled demo data.
- Auth / user accounts / multi-tenancy / RBAC — single-operator local tool.
- WhatsApp and Slack — Telegram only (PRD requires "at least one").
- Hard cost *enforcement* beyond tracking + a soft guardrail stop.
- Mobile-native apps; i18n; production scaling infra (described in README, not built).

## Screens / routes (demo inventory — the build contract)

| Route | Screen | Purpose | Key components | Data shown |
|---|---|---|---|---|
| `/` | **Dashboard / Live Monitor** | System pulse + live feed | metrics row, active-agents list, live event stream, recent runs | agent count, active runs, total tokens/cost, SSE event log |
| `/agents` | **Agents** | List + create/delete | table, "New agent", row actions, status pills | name, role, model, channels, status |
| `/agents/:id` | **Agent Editor** | Configure every dimension | tabbed form: Identity · Tools · Channels · Schedules · Memory · Skills · Interaction rules · Guardrails | system prompt, model, tool toggles, cron/intervals, memory facts, skills, autonomy/approval rules, cost/rate/blocked limits |
| `/workflows` | **Workflows** | List defs + load templates | cards/table, "Load template" (Cross-Border Payout, Dev Pipeline), "New workflow" | name, description, #nodes, template badge |
| `/workflows/:id` | **Workflow Builder** | Wire the graph | canvas with agent nodes + conditional edges, edge condition picker, "Run" | nodes (agents), edges (condition, label), feedback/approval markers |
| `/runs` | **Runs** | Execution history | filterable table, status pills, "open" | run id, workflow, status, started, duration, tokens/cost |
| `/runs/:id` | **Run View** | Live execution of one run | live graph w/ node states, **inter-agent message trail**, approval-gate prompt, per-step output + tokens | step states, messages (from→to, content), gate state, token/cost per step |
| `/channels` | **Channels (Telegram)** | Channel status + message log | bot status card, bound-agents list, inbound/outbound log, "send test" | bot online?, which agent bound, recent Telegram messages |
| `/evals` | **Evaluations** | Score agents/workflows + A/B configs | metrics row, scenario scorecard table, experiment A/B compare | task completion rate, A2A reliability, per-scenario pass/fail, config-vs-config deltas |

> 9 screens. Phase 3 builds exactly these; Phase 4 implements exactly these.

## Data model (SQLite; minimal but complete)

- **Agent**(id, name, role, systemPrompt, model, tools `json[]`, channels `json[]`,
  interactionRules `json`, guardrails `json`, createdAt, updatedAt)
- **Schedule**(id, agentId→Agent, kind `cron|interval`, expr, enabled)
- **MemoryFact**(id, agentId→Agent, key, value, createdAt)
- **Skill**(id, agentId→Agent, name, steps `json[]` ordered tool refs)
- **Workflow**(id, name, description, isTemplate, nodes `json[]` {nodeId, agentId, pos},
  edges `json[]` {from, to, condition `on_complete|on_approve|on_reject`, label})
- **Run**(id, workflowId→Workflow, status `pending|running|awaiting_approval|completed|failed`,
  startedAt, finishedAt, totalTokens, totalCostUsd)
- **RunStep**(id, runId→Run, nodeId, agentId, status, input `json`, output `json`,
  tokens, costUsd, startedAt, finishedAt)
- **Message**(id, runId→Run nullable, fromAgentId nullable, toAgentId nullable,
  channel `internal|telegram`, direction `in|out|a2a`, content, meta `json`, createdAt)
  — the persisted **conversation trail** (inter-agent + Telegram).
- **ChannelBinding**(id, agentId→Agent, channel `telegram`, externalChatId, status)
- **Payment**(id, runId→Run, invoicePayload, amount, currency, status `pending|paid|refunded`,
  telegramChargeId, providerChargeId, createdAt) — the Telegram Payments pay-in record.
- **EventLog**(id, runId nullable, level, type, message, createdAt) — live-monitor feed.
- **EvalScenario**(id, name, workflowId→Workflow, input `json`, expectations `json[]` {kind, target}, enabled)
- **EvalResult**(id, scenarioId→EvalScenario, runId→Run, passed, checks `json[]`, score, tokens, createdAt)
- **Experiment**(id, name, scenarioSet `json[]`, variantA `json`, variantB `json`, metrics `json`) — A/B compare.

Guardrails (embedded json): `maxTokensPerRun`, `maxCostUsd`, `rateLimitPerMin`,
`blockedActions[]`, `approvalThresholdUsd`. Interaction rules (embedded json):
`autonomous[]` vs `requiresApproval[]` action lists.

## AI surface (runtime — what the deployed Anthropic key powers, via Goose)

1. **Workflow-node execution.** When a run reaches a node, the platform invokes Goose with
   the agent's `systemPrompt` + role + the inbound message + that agent's allowed tools.
   - *Input:* inbound message/context + memory facts. *System prompt:* agent identity/role.
   - *Output:* result text + structured tool-call trace + token usage.
   - *Renders:* Run View step output + message trail; tokens roll up to Run + Dashboard.
2. **Telegram conversational turn.** A human message to the bound agent is routed into Goose
   (same agent config + memory), the reply is sent back via Telegram.
   - *Input:* user text + agent memory. *Output:* reply text. *Renders:* Telegram + Channels log.
3. **Eval LLM-judge (offline).** The scorer calls a model to grade *soft* outcomes the
   deterministic checks can't (e.g. "was the clarification reply appropriate?").
   - *Input:* scenario + expected behavior + actual transcript. *Output:* pass/fail + rationale.
   - *Renders:* Evaluations scorecard. Runs in the harness, never on the live request path.

> Surfaces 1–2 go through the **Goose adapter** using the agent's config — real tool loop, real
> token usage (the PRD's "not a UI mockup" bar). Surface 3 is an offline scoring call used only
> by the eval harness.

## External integrations (only what the demo needs)

- **Goose** (runtime) — native `anthropic` provider via `ANTHROPIC_API_KEY`. Invocation mode
  resolved in Phase 4 (see Open questions); the adapter abstracts it.
- **Telegram Bot API** — `getUpdates` long-poll (simplest, no public webhook needed locally)
  + `sendMessage`. Token from BotFather; `TELEGRAM_CHAT_ID` for the demo chat.
- **Telegram Payments (TEST)** — `sendInvoice` + `answerPreCheckoutQuery` + `successful_payment`,
  using a Stripe **test** provider token from BotFather (`TELEGRAM_PAYMENT_PROVIDER_TOKEN`).
  Funds collect into a test merchant account; `successful_payment` advances the run; unpaid/
  rejected → refund + notify. No real money.
- **FX rate (remittance tool)** — default **mocked** rate table; optional free no-key endpoint
  (e.g. open.er-api.com) behind a flag, clearly labeled.
- **Sanctions screening (remittance tool)** — **mocked** static denylist; labeled demo data.

## Workflow templates (both shipped, both seeded on setup)

**A. Cross-Border Payout (Yuno-themed remittance).** Telegram intake + Telegram Payments pay-in (TEST); feedback loop; approval gate.
```
Intake --on_complete--> Compliance
Compliance --on_reject(needs info)--> Intake          # feedback loop
Compliance --on_approve--> FX Quote
FX Quote --on_complete--> Collect (Telegram invoice, TEST)
Collect --on_complete(paid)--> [approval gate if amount > cap] --on_approve--> Payout(simulated)
Collect --on_reject(unpaid/timeout)--> Intake (refund + notify)
```
Tools (mock unless noted): `parse_remittance`, `screen_sanctions`, `check_limits`, `get_fx_rate`,
`quote_fees`, `send_invoice` (real — Telegram Payments TEST), `initiate_payout` (mock).
Intake bound to Telegram + Payments. `Collect` emits `on_complete` on `successful_payment`.

**B. Dev Pipeline (PRD example).** Feedback loop.
```
Coder --on_complete--> Reviewer
Reviewer --on_reject--> Coder                        # feedback loop
Reviewer --on_approve--> Deployer(simulated)
```
Tools: `write_code`, `review_code`, `deploy` (mock/sandbox).

## Acceptance criteria (reviewer- and live-verify-tickable)

- [ ] Create / edit / delete an agent in the UI; **all** config dimensions persist across reload.
- [ ] Load the **Cross-Border Payout** template; it appears in the builder with nodes, a
      feedback edge, and an approval gate.
- [ ] Run a 2+-agent workflow: agents **call tools, exchange messages, reach a conclusion**;
      the message trail is visible in Run View; **tokens/cost are tracked** per step + total.
- [ ] Feedback loop fires: a `reject` routes back to the upstream agent (driven by edge data).
- [ ] Approval gate: an over-threshold step pauses `awaiting_approval`; approving resumes to completion.
- [ ] **Telegram**: message the bot from Telegram → the bound agent replies using its
      config/memory; the exchange appears in Channels + increments monitoring counters.
- [ ] **Telegram pay-in (TEST)**: after the quote, the sender pays an in-chat invoice with a
      test card; `successful_payment` advances the run to the approval gate; an unpaid/timed-out
      invoice refunds + notifies. No real money moves.
- [ ] Monitoring updates **live (SSE)**: status, logs, inter-agent messages, progress, token/cost.
- [ ] Runtime is **real Goose execution** — tool calls are visible, not faked.
- [ ] **One command** brings up the whole stack locally; tests pass for agent creation,
      workflow execution, and message delivery.
- [ ] **Evals:** `make eval` replays the golden scenarios through the real engine and prints
      task-completion-rate + A2A-reliability; the Evaluations screen shows the scorecard and an
      A/B comparison of two configs.

## Open questions (architecture-blocking only)

1. **Goose invocation mode.** `goose run --recipe --params` (one-shot per task; deterministic,
   testable, simplest) vs `goose serve` ACP JSON-RPC + SSE (streaming tokens; richer but more
   moving parts). **Lean:** recipe-per-task for the workflow engine, with streaming as an
   enhancement if time allows; abstract behind a `GooseRunner` interface so it's swappable.
   To be confirmed by a short Phase-4 smoke test. *Not blocking Phases 1–3.*

Everything else is decided. No other open architectural questions.
