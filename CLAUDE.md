@AGENTS.md

# Agent Workflow

Code-change requests can run through the **agent harness**: subagents (planner, developer, quality-reviewer, merger, documentator) implementing the change via a deterministic foreground pipeline in git worktrees. **Opt-in, off by default;** otherwise the main thread implements the change itself.

**Dispatch rule (top-level session only).** Only on an opt-in (see "Opting in") does the top-level session dispatch the `orchestrator` and relay its result; never route or implement it yourself then. Pass your `<session_dir>` in the prompt (it namespaces worktrees/branches). A subagent NEVER dispatches an orchestrator (`block-nested-orchestrator` enforces it). The orchestrator owns all routing (SIMPLE/COMPLEX, plus SETUP/MEMORY/ROLLBACK-CONFLICT/RECOVERY, dispatch templates, waves, promotion, migration round) and drives the team to a terminal point. Each agent's last line is an output contract (`.claude/rules/agent-output-format.md`).

**"Launched" is NOT "done".** The dispatch is meant to block, but some runtimes (interactive Claude Code / the VS Code extension) return immediately with `Async agent launched … agentId: <id>` and deliver the result later as a `task-notification`. That ack means dispatched, not finished: do NOT fill the silence by implementing the feature yourself or re-dispatching (that duplicates the developer's work). While it runs, only surface progress, then relay the final report. On completion, before relaying, check `<session_dir>/needs-recovery` (written by `completion-invariant` when the orchestrator stopped with APPROVED-but-unmerged work): if present, dispatch a FRESH `orchestrator` with `<intent>recovery</intent>` and the same `<session_dir>` (never `SendMessage` the old one), wait, then relay.

**PD-ASK round-trip (migration confirmation).** The orchestrator may end its turn asking *"apply the database migration now?"*. Relay it to the user; do NOT `SendMessage` the old orchestrator to relay the answer (relayed approvals carry no user authority, so it loops re-asking). On the reply:
- **Approved**: FIRST write `<session_dir>/migration-approval.json` = `{"kind":"migration-approval","session_id":"<id>","question":"<asked>","answer":"<user's verbatim reply>","approved_at":"<ISO-8601>","via":"AskUserQuestion"}` (the durable audit trail). THEN dispatch a FRESH `orchestrator` whose prompt begins `<intent>apply-migration</intent>`, states the approval, references that record, and passes the same `<session_dir>`. The built-in security warning on a relayed approval is expected.
- **Wants changes**: dispatch a fresh `orchestrator` with the new request.

While a fresh dispatch runs, don't start a parallel plan B; wait, then relay.

**Gate level.** A request may carry `gate=none|plan|waves` (default **`plan`**); ALWAYS pass an explicit `GATE: <level>` line (the orchestrator also fails closed to `plan` on a missing/unknown value). `plan` pauses after planning for ticket review; `none` runs autonomously; `waves` also pauses at each wave. On a plan pause, relay the plan + question; on approval dispatch a FRESH `orchestrator` with `<intent>execute-plan</intent>` and the same `<session_dir>` (never `SendMessage`); on "wants changes" dispatch a fresh one. CRM Builder's launcher sets `gate=none`.

## Opting in

Off by default. `#harness` (or "use the agent team" / "with the harness") routes through the orchestrator; "harness for this session" keeps it on all session.

**Grill vague requests first.** For a vague or broad `#harness` request, run `Skill({skill: "grill-me"})` in the main thread BEFORE dispatching (the planner never questions; `gate=plan` only reacts after a plan). Fold the answers into the dispatch prompt. Skip when the request is already precise.

`#technical-harness` is the same opt-in for a real developer: it appends a `PERSONA: technical` line (see `orchestrator.md` -> "`PERSONA: technical`"), which (1) uses the full technical register (file paths, `TASK-XXX`, git terms, `database`/`migration`/`Supabase`), (2) reports the mechanical truth (per-ticket status, branches, SHAs, verdicts, ADR paths), (3) stops at `session/<id>` (no promotion, no migration round; you promote and migrate yourself), and (4) appends every step to `<session_dir>/harness-progress.log`.

**Live progress in the chat (technical runs).** The report lands only at the end (possibly as a `task-notification`), so feed the log live: dispatch the orchestrator with `run_in_background: true`, then `Monitor({command: "tail -n +1 -F <session_dir>/harness-progress.log", description: "harness progress", persistent: true})` (real `<session_dir>`; `-F` tolerates a missing file). Do nothing else while it runs. The authoritative end signal is the `task-notification`, not the log: on it, `TaskStop` the monitor, relay the report, and run `/harness-diff` on the session branch it stopped on.

## Agents

orchestrator (routes the harness, dispatched by the main thread), planner, developer, quality-reviewer, merger, documentator. Models: **planner** and **quality-reviewer** on opus, the rest on sonnet/haiku (see each `.claude/agents/*.md`). The web-chat variant is this orchestrator with a non-technical persona injected via `--append-system-prompt` (CRM Builder).

The **developer** is one agent, no modes: it implements a `TICKET_FILE` (COMPLEX wave, peer-reviewed, ADRs for structural decisions, never SQL during tickets) or an inline `CHANGE_REQUEST` (SIMPLE, on the shared `<base>/simple` worktree; refuses `FAILED: out of scope, needs COMPLEX flow` if it needs a breakdown). Two session ops reach it as dispatch-loaded skills on `<base>/simple`: `writing-migrations` and `resolving-rollback-conflicts`. It applies the **Ponytail** ladder (full mode) on every change (baked into `developer.md`; the quality-reviewer enforces it on the diff). Ponytail is also in-repo as `.claude/skills/ponytail*` / `/ponytail*` for interactive use (these do not affect the dev agents). An optional `test-writer` runs only when a ticket sets `separate_test_writer: true`.

## Rules & hooks

Mechanics live in `.claude/rules/` (worktree-scope, agent-output-format, validation-commands, lsp-usage, security-triggers, dependency-safety, launcher-interface). Project facts (validation steps, roles, deploy adapter, app smoke, launcher extension points) live in `harness.config.json`. Hooks in `.claude/settings.json` / `.claude/hooks/` are `.mjs` ES modules.
