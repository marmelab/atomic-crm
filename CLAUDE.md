@AGENTS.md

# Agent Workflow

Code-change requests can be handled by the **agent harness**: a team of subagents (planner, developer, quality-reviewer, merger, documentator) that implements the change through a deterministic, foreground pipeline in git worktrees. **It is opt-in and does NOT run by default;** by default the main thread implements the change itself, no agents.

**Dispatch rule (top-level session only).** Only when the request opts into the harness (triggers under "Opting in") does the top-level session dispatch the `orchestrator` agent and relay its result; never route or implement it yourself in that case. Pass your context's `<session_dir>` in the dispatch prompt (the orchestrator needs it to namespace worktrees and branches). If you are a subagent (already inside the harness), ignore this: do your own job and never dispatch an orchestrator (the `block-nested-orchestrator` hook enforces it). The orchestrator owns all routing (classification SIMPLE vs COMPLEX, plus the SETUP / MEMORY / ROLLBACK-CONFLICT / RECOVERY intents, dispatch templates, wave + promotion mechanics, and the deploy-time migration round); it drives developer/reviewer/merger to a terminal point before returning. Each agent's last line is an output contract the others parse (`.claude/rules/agent-output-format.md`).

**"Launched" is NOT "done" (read before you fill the silence).** The dispatch is *meant* to block until the orchestrator's final report, but in some runtimes (interactive Claude Code / the VS Code extension) the `Agent` tool returns immediately with `Async agent launched successfully … agentId: <id>` and the real result arrives later as a `task-notification`. That acknowledgement means dispatched, not finished. Do NOT read the quiet as "nothing is happening", and do NOT start implementing the feature yourself (no `Write`/`Edit`/`Bash` on the change, no re-dispatch): that is the exact bug that produces a duplicate, the main thread coding the same feature the orchestrator's developer is already building. While it runs your ONLY job is to wait for the matching `task-notification`, then relay the orchestrator's final report. This mirrors the guard the orchestrator applies to its own workers (`.claude/agents/orchestrator.md` → "launched is NOT done").

**PD-ASK round-trip (migration confirmation).** The orchestrator ends its turn with a pending question, typically *"apply the database migration now?"*, and the task completes. Relay it to the user (plain text or `AskUserQuestion`). Do NOT resume the old orchestrator with `SendMessage` to relay the answer: the runtime tags coordinator messages as carrying no user authority, so a relayed approval is ignored and the orchestrator loops re-asking forever. On the user's reply:
- **Approved**: dispatch a **fresh** `orchestrator` (new `Agent` call) whose prompt begins with `<intent>apply-migration</intent>`, states the approval, and passes the same `<session_dir>`; it resumes the migration round from disk and applies it.
- **Wants changes**: dispatch a fresh `orchestrator` with the new request as usual.

While that fresh dispatch runs, do not start a parallel plan B (don't generate the migration yourself, don't `TaskStop` it); wait for it to finish, then relay its result.

## Opting in

Off by default. `#harness` (or "use the agent team" / "with the harness") routes a request through the orchestrator; "harness for this session" keeps it on for the whole session.

## Agents

orchestrator (routes the harness, dispatched by the main thread), planner, developer, quality-reviewer, merger, documentator. Models/roles: see each `.claude/agents/*.md`; **planner** and **quality-reviewer** run on opus, everything else on sonnet or haiku. (The web-chat variant is this same `orchestrator` with a non-technical persona layered on at launch via `--append-system-prompt`, used by CRM Builder.)

The **developer** is a single agent with no modes: it implements the ticket in `TICKET_FILE` (COMPLEX wave, peer-reviewed, writes ADRs for structural decisions, never writes SQL during tickets), or for a SIMPLE dispatch the change described inline via `CHANGE_REQUEST` (no ticket, no planner, on the shared `<base>/simple` worktree; it refuses with `FAILED: out of scope, needs COMPLEX flow` if the change needs a breakdown). Two session-level operations reach it as **skills** loaded on dispatch, run on the same `<base>/simple` worktree: `writing-migrations` (deploy-time SQL generation) and `resolving-rollback-conflicts` (replay merge-commit reverts). It applies the **Ponytail** minimization ladder (full mode) on every change via an inline prompt directive, the only mechanism that reaches `Agent`-dispatched subagents. Ponytail is also installed natively in-repo as on-demand skills (`.claude/skills/ponytail*`) and `/ponytail*` commands for interactive use in the main session; these do not affect the dev agents.

## Rules & hooks

Mechanics live in `.claude/rules/` (worktree-scope, agent-output-format, validation-commands, lsp-usage, security-triggers). Hooks in `.claude/settings.json` / `.claude/hooks/` are `.mjs` ES modules.
