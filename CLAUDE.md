@AGENTS.md

# Agent Workflow

Code-change requests are handled by the **agent harness** by default: a team of subagents (planner, developer, quality-reviewer, merger, documentator) that implements the change through a deterministic, foreground pipeline in git worktrees.

**When the main (top-level) session receives a code-change request, dispatch the `orchestrator` agent and relay its result — never route or implement it yourself.** Pass the `<session_dir>` value from your own context in the dispatch prompt (the orchestrator needs it to namespace worktrees and branches). **This directive is for the top-level session only: if you are a subagent (already inside the harness), ignore it — do your own job and never dispatch an orchestrator. A runtime hook (`block-nested-orchestrator`) enforces this.** The `orchestrator` owns all routing (classification SIMPLE vs COMPLEX, plus the SETUP / MEMORY / ROLLBACK-CONFLICT / RECOVERY operational intents, the dispatch templates, the wave + promotion mechanics, and the deploy-time migration round); it drives developer/reviewer/merger to a terminal point before returning. Each agent's last line is an output contract the others parse (`.claude/rules/agent-output-format.md`).

**PD-ASK round-trip (migration confirmation).** The orchestrator ends its turn with a pending question — typically *"apply the database migration now?"* — and the task completes. Relay that question to the user (plain text or `AskUserQuestion`). **Do NOT resume the old orchestrator with `SendMessage` to relay their answer:** the runtime tags coordinator messages as carrying no user authority, so a relayed approval is ignored and the orchestrator loops re-asking forever. Instead, on the user's reply:
- **Approved** → dispatch a **fresh** `orchestrator` (a new `Agent` call) whose prompt begins with `<intent>apply-migration</intent>`, states the approval, and passes the same `<session_dir>`. It resumes the migration round from disk and applies it.
- **Wants changes** → dispatch a fresh `orchestrator` with their new request as usual.

While that fresh dispatch runs, **do not start a parallel plan B** (don't generate the migration yourself, don't `TaskStop` it) — wait for it to finish, then relay its result.

## Opting out

`#no-harness` (or "implement directly" / "without the agent team" / "skip harness") makes the main thread implement the change itself, no agents. "no-harness for this session" keeps it off for the whole session.

## Agents

orchestrator (routes the harness, dispatched by the main thread), planner, developer, quality-reviewer, merger, documentator. Models/roles: see each `.claude/agents/*.md`. **planner** and **quality-reviewer** run on opus; everything else is sonnet or haiku. (The web-chat variant is this same `orchestrator` agent with a non-technical persona layered on at launch via `--append-system-prompt` — used by CRM Builder.)

The **developer** is a single agent with no modes: it implements the ticket in `TICKET_FILE` (COMPLEX wave, peer-reviewed, writes ADRs for structural decisions, never writes SQL during tickets), or — for a SIMPLE dispatch — the change described inline via `CHANGE_REQUEST` (no ticket, no planner, on the shared `<base>/simple` worktree; it refuses with `FAILED: out of scope — needs COMPLEX flow` if the change needs a breakdown). Two session-level operations are handed to it as **skills** loaded on dispatch, run on the same `<base>/simple` worktree: `writing-migrations` (deploy-time SQL generation) and `resolving-rollback-conflicts` (replay merge-commit reverts). It applies the **Ponytail** minimization ladder (full mode) on every change via an inline prompt directive — the only mechanism that reaches `Agent`-dispatched subagents. Ponytail is also installed natively in-repo as on-demand skills (`.claude/skills/ponytail*`) and `/ponytail*` commands for interactive use in the main session; these do not affect the dev agents.

## Rules & hooks

Mechanics live in `.claude/rules/` (worktree-scope, agent-output-format, validation-commands, lsp-usage, security-triggers). Hooks in `.claude/settings.json` / `.claude/hooks/` are `.mjs` ES modules.
