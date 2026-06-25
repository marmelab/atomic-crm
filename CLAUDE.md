@AGENTS.md

# Agent Workflow

Code-change requests are handled by the **agent harness** by default: a team of subagents (planner, developer, quality-reviewer, merger, documentator) that implements the change through a deterministic, foreground pipeline in git worktrees.

**To handle a code-change request, dispatch the `orchestrator` agent and relay its result — never route or implement it yourself.** Pass the `<session_dir>` value from your own context in the dispatch prompt (the orchestrator needs it to namespace worktrees and branches). The `orchestrator` owns all routing (classification SIMPLE vs COMPLEX, plus the SETUP / MEMORY / ROLLBACK-CONFLICT / RECOVERY operational intents, the dispatch templates, the wave + promotion mechanics, and the deploy-time migration round); it drives developer/reviewer/merger to a terminal point before returning. Each agent's last line is an output contract the others parse (`.claude/rules/agent-output-format.md`).

## Opting out

`#no-harness` (or "implement directly" / "without the agent team" / "skip harness") makes the main thread implement the change itself, no agents. "no-harness for this session" keeps it off for the whole session.

## Agents

orchestrator (routes the harness, dispatched by the main thread), planner, developer, quality-reviewer, merger, documentator. Models/roles: see each `.claude/agents/*.md`. **planner** and **quality-reviewer** run on opus; everything else is sonnet or haiku. (`chat-orchestrator` is the web-chat variant — orchestrator routing + a non-technical persona — used by CRM Builder.)

The **developer** is a single agent with no modes: it implements the ticket in `TICKET_FILE` (COMPLEX wave, peer-reviewed, writes ADRs for structural decisions, never writes SQL during tickets), or — for a SIMPLE dispatch — the change described inline via `CHANGE_REQUEST` (no ticket, no planner, on the shared `<base>/simple` worktree; it refuses with `FAILED: out of scope — needs COMPLEX flow` if the change needs a breakdown). Two session-level operations are handed to it as **skills** loaded on dispatch, run on the same `<base>/simple` worktree: `writing-migrations` (deploy-time SQL generation) and `resolving-rollback-conflicts` (replay merge-commit reverts). It applies the **Ponytail** minimization ladder (full mode) on every change via an inline prompt directive — the only mechanism that reaches `Agent`-dispatched subagents. Ponytail is also installed natively in-repo as on-demand skills (`.claude/skills/ponytail*`) and `/ponytail*` commands for interactive use in the main session; these do not affect the dev agents.

## Rules & hooks

Mechanics live in `.claude/rules/` (worktree-scope, agent-output-format, validation-commands, security-triggers). Hooks in `.claude/settings.json` / `.claude/hooks/` are `.mjs` ES modules.
