@AGENTS.md

# Agent Workflow

This project ships CRM changes through a coordinated agent team rather than a single implementer. Once a plan is approved (via `ExitPlanMode`), the main thread / orchestrator does not implement directly — it routes the work to the custom agents defined under `.claude/agents/`. Each agent's full contract lives in its own file; this section is the map of who does what, and in which order.

## Routing: SIMPLE vs COMPLEX

The **chat-orchestrator** is the user-facing entry point. It routes, narrates progress, and never implements. It classifies each request:

- **SIMPLE** — one cosmetic edit, OR a single-field change on an existing entity (schema + view + type + form + show), OR one list filter that reuses existing components (no new custom React component). Dispatched straight to a **simple-developer** + **merger** — no team, no peer review. `SubagentStop` hooks validate; a deploy-time migration round runs only if a migration was written.
- **COMPLEX** — everything else. Goes through the full planner → wave → review → merge pipeline below.

## COMPLEX pipeline

1. **planner** — decompose the approved plan into atomic, ordered tickets (JSON) with best-guess file paths and dependency waves. Skip only when the plan is already a single atomic deliverable (one file, one fix, one migration).
2. **developer** (one per ticket) — implement + commit inside the ticket's git worktree. Tickets in the same wave (`parallel_safe: true`, no mutual dependency) are spawned in parallel — a single message with multiple `Agent` tool uses. Developers also write an ADR under `adr/` when a change introduces a structural decision, and never write SQL migrations (those are generated at deploy time).
3. **quality-reviewer** + **test-validator** (per ticket, in parallel) — quality-reviewer does combined semantic code + security review; test-validator checks integration wiring and e2e presence. Neither re-runs validation (hooks already do).
4. **merger** — `git merge --no-ff` only; never `git add` / `git commit`. A single shared merger per wave avoids `.git/index.lock` contention.
5. **documentator** — auto-runs at the end of every COMPLEX session, appending business knowledge to `MEMORY.md` from the session diff. (Mode 1 also captures reusable rules/skills on explicit user request.)

The `agent-team` skill is the single source of truth for team layout and cross-agent messaging: one `TeamCreate` per wave, `3×N + 1` members in one dispatch (developer + 2 reviewers per ticket + one shared merger). One team per lead — no nested teams.

## Agent team

| Agent | Model | Role |
|---|---|---|
| chat-orchestrator | sonnet | User-facing. Routes, narrates. SIMPLE flow dispatches simple-developer + merger directly (no team). |
| planner | sonnet | Decomposes the plan into tickets JSON with waves + file hints. |
| developer | opus | Implements + commits in a worktree. Writes ADRs for structural decisions. Never writes SQL migrations (deploy-time only). |
| simple-developer | sonnet | One cosmetic edit, one single-field entity change, or one filter reusing existing components. No team, no review. |
| quality-reviewer | sonnet | Combined semantic code + security review only. Never re-runs validation. |
| test-validator | haiku | Integration wiring + e2e presence. |
| merger | haiku | `git merge --no-ff` only. Never `git add` / `git commit`. |
| documentator | sonnet | Mode 1 — captures rules/skills on request. Mode 2 — appends business knowledge to `MEMORY.md` at COMPLEX session end. |

Only **developer** runs on opus; everything else is sonnet or haiku.

## The orchestrator's job between hand-offs

Relay agent reports, surface blockers, and stop to ask the user whenever an agent flags an open question or a `BLOCKED` verdict. Do not bypass this flow for "small-looking" changes — the trigger is *plan approved*, not *task size*. Direct requests that never entered plan mode are not subject to this workflow.

## Supporting rules

The mechanics each agent must follow live in `.claude/rules/`:

- **worktree-scope** — every ticket agent works only inside its own worktree; never read/edit the base-branch checkout. Covers session-branch topology and the merge path.
- **agent-output-format** — the structured-text contract every agent returns.
- **validation-commands** — typecheck / prettier / unit / e2e are automated by hooks; agents must not run them manually.
- **security-triggers** — when a change warrants extra security scrutiny.

Claude Code hooks (configured in `.claude/settings.json`, stored in `.claude/hooks/`) must be written as `.mjs` files (ES modules).
