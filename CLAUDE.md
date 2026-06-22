@AGENTS.md

# Agent Workflow

This project ships CRM changes through a coordinated agent team rather than a single implementer. Once a plan is approved (via `ExitPlanMode`), the main thread / orchestrator does not implement directly — it routes the work to the custom agents defined under `.claude/agents/`. Each agent's full contract lives in its own file; this section is the map of who does what, and in which order.

## Routing: one pipeline for every change

The **chat-orchestrator** is the user-facing entry point. It routes, narrates progress, and never implements. There is **no SIMPLE-vs-COMPLEX triage**: every request that changes the CRM code or schema — a one-line label rename just as much as a new entity with relations — runs the **same pipeline** below. A tiny change is simply a one-ticket wave. The orchestrator only branches away from this pipeline for non-code operational intents: SETUP (project scoping), MODE-SWITCH (demo/real data), MEMORY (capture a pattern), ROLLBACK-CONFLICT (resolve a failed automatic revert), and RECOVERY (resume after an interruption).

## The pipeline

1. **planner** — decompose the approved plan into atomic, ordered tickets (JSON) with best-guess file paths and dependency waves. Skip only when the plan is already a single atomic deliverable (one file, one fix).
2. **developer** (one per ticket) — implement + commit inside the ticket's git worktree. Tickets in the same wave (`parallel_safe: true`, no mutual dependency) are spawned concurrently as **foreground** subagents — a single message with multiple `Agent(...)` tool uses (no `run_in_background`); the orchestrator's turn resumes once they all return. Developers also write an ADR under `adr/` when a change introduces a structural decision, and never write SQL migrations (those are generated at deploy time).
3. **quality-reviewer** — the single reviewer: combined semantic code + security review (Parts A, B) plus QA / runtime validation — integration wiring, behavior-verifiable acceptance criteria, e2e presence (Part C). Never re-runs validation (hooks already do).
4. **merger** — `git merge --no-ff` only; never `git add` / `git commit`. One merger is dispatched per ticket (Stage A: feature branch → session branch); a final promotion merger (`MODE: promote`) moves the session branch onto `main` once the wave is done, serialised across sessions by a `flock` on the shared `.git`.
5. **documentator** — auto-runs at the end of every session, appending business knowledge to `MEMORY.md` from the session diff. (Mode 1 also captures reusable rules/skills on explicit user request.)

There is no cross-agent messaging: the orchestrator dispatches every agent as a **foreground subagent** (`Agent(...)`, no `run_in_background`) and drives the wave **synchronously within one continuous turn** (chat-orchestrator.md STATE B) — a foreground call blocks until the subagent returns, and several in one message run concurrently and return together. Each wave flows through three barriered stages: develop (concurrent) → review + bounded retry (concurrent) → merge (sequential, since per-ticket mergers share the session branch). This replaces an earlier event-driven background model, which stalled when a background completion woke the wrong subagent instead of the orchestrator. Each agent's last output line is an **output contract** (`DONE: …` / `FAILED: …` / `APPROVED` / `REJECTED: …`) that the orchestrator parses to choose the next dispatch (see `.claude/rules/agent-output-format.md`). PreToolUse/Agent hooks prepare the worktree (`setup-worktree`) and gate the flow (`enforce-dev-dispatch`, `block-merger-without-review`, `block-promote-unmerged`); SubagentStop hooks validate (`validate-on-stop`) and record review verdicts (`record-review-verdict`).

## Agent team

| Agent | Model | Role |
|---|---|---|
| chat-orchestrator | sonnet | User-facing. Routes every code change through the one pipeline; narrates progress; never implements. |
| planner | opus | Decomposes the plan into tickets JSON with waves + file hints. |
| developer | sonnet | One agent, no modes. Implements the ticket in `TICKET_FILE`: plans, commits in a per-ticket worktree, peer-reviewed, writes ADRs for structural decisions, never writes SQL migrations during tickets. Two session-level operations are handed to it as **skills** (loaded on dispatch, run on the shared `<base>/ops` worktree): `writing-migrations` (deploy-time SQL generation) and `resolving-rollback-conflicts` (replay merge-commit reverts). Applies the **Ponytail** minimization ladder (full mode) automatically via an inline prompt directive. |
| quality-reviewer | opus | Sole reviewer: combined semantic code + security review AND QA/runtime validation (integration wiring, behavior criteria, e2e presence). Never re-runs validation. |
| merger | haiku | `git merge --no-ff` only. Never `git add` / `git commit`. |
| documentator | haiku | Mode 1 — captures rules/skills on request. Mode 2 — appends business knowledge to `MEMORY.md` at session end. |

**planner** and **quality-reviewer** run on opus; everything else is sonnet or haiku.

The **developer** applies the **Ponytail** minimization ladder (full mode) on every change — in every mode — via inline directives in its prompt, the only mechanism that reaches `Agent`-dispatched subagents. Ponytail is also installed **natively** in-repo as on-demand skills (no plugin, no marketplace, no hooks): its skills live in `.claude/skills/ponytail*` and its `/ponytail*` commands in `.claude/commands/`, for interactive use in the main session (`/ponytail-review`, `/ponytail-audit`, …). These do not affect the dev agents, whose ladder comes from the inline directives above.

## The orchestrator's job between hand-offs

Relay agent reports, surface blockers, and stop to ask the user whenever an agent flags an open question or a `FAILED` outcome the orchestrator can't resolve. (A reviewer `REJECTED` verdict is handled silently by the bounded developer-retry loop, not surfaced to the user.) Do not bypass this flow for "small-looking" changes — the trigger is *plan approved*, not *task size*. Direct requests that never entered plan mode are not subject to this workflow.

## Supporting rules

The mechanics each agent must follow live in `.claude/rules/`:

- **worktree-scope** — every ticket agent works only inside its own worktree; never read/edit the base-branch checkout. Covers session-branch topology and the merge path.
- **agent-output-format** — the structured-text contract every agent returns.
- **validation-commands** — typecheck / prettier / unit / e2e are automated by hooks; agents must not run them manually.
- **security-triggers** — when a change warrants extra security scrutiny.

Claude Code hooks (configured in `.claude/settings.json`, stored in `.claude/hooks/`) must be written as `.mjs` files (ES modules).
