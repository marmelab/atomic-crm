@AGENTS.md

# Agent Workflow

Once a plan is approved (`ExitPlanMode`), the main thread does not implement directly — it routes to the agents in `.claude/agents/` (each carries its own full contract). Trigger is *plan approved*, not task size.

## Opting out

Harness routing is the **default**. `#no-harness` (or "implement directly" / "without the agent team" / "skip harness") makes the main thread implement itself, no agents, even after plan approval. "no-harness for this session" keeps it off all session. Irrelevant under `make harness` (orchestrator always routes).

## Routing: SIMPLE vs COMPLEX

The **chat-orchestrator** is the user-facing entry point. It routes, narrates progress, and never implements. It classifies each code change:

- **SIMPLE** — one cosmetic edit, OR one single-field change on an existing entity (schema + view + type + form + show), OR one list filter reusing existing components (no import, no relations, no new custom component). The orchestrator skips the planner and the wave: it dispatches ONE `developer` directly with the change request on the shared `<base>/simple` worktree, reviews only if the diff touched `supabase/`, then merges. No planner, no peer review otherwise.
- **COMPLEX** — everything else (default). Runs the full pipeline below.

SIMPLE vs COMPLEX is purely a routing decision the orchestrator owns — the `developer` itself has no modes. The orchestrator also branches away for non-code operational intents: SETUP, MODE-SWITCH, MEMORY, ROLLBACK-CONFLICT, RECOVERY.

## The COMPLEX pipeline

planner (tickets JSON + waves) → developer per ticket (implements + commits in a worktree; no SQL migrations, deploy-time only) → quality-reviewer (code + security + QA) → merger (`git merge --no-ff` only; Stage A per ticket, then one `MODE: promote` to the base branch under `flock`) → documentator (appends to `MEMORY.md`). Agents run as **foreground** subagents in one synchronous turn; each agent's last line is an output contract the orchestrator parses (`.claude/rules/agent-output-format.md`).

## Agents

chat-orchestrator (routes, narrates), planner, developer, quality-reviewer, merger, documentator. Models/roles: see each `.claude/agents/*.md`. **planner** and **quality-reviewer** run on opus; everything else is sonnet or haiku.

The **developer** is a single agent with no modes: it implements the ticket in `TICKET_FILE` (COMPLEX wave, peer-reviewed, writes ADRs for structural decisions, never writes SQL during tickets), or — for a SIMPLE dispatch — the change described inline via `CHANGE_REQUEST` (no ticket, no planner, on the shared `<base>/simple` worktree; it refuses with `FAILED: out of scope — needs COMPLEX flow` if the change needs a breakdown). Two session-level operations are handed to it as **skills** loaded on dispatch, run on the same `<base>/simple` worktree: `writing-migrations` (deploy-time SQL generation) and `resolving-rollback-conflicts` (replay merge-commit reverts). It applies the **Ponytail** minimization ladder (full mode) on every change via an inline prompt directive — the only mechanism that reaches `Agent`-dispatched subagents. Ponytail is also installed natively in-repo as on-demand skills (`.claude/skills/ponytail*`) and `/ponytail*` commands for interactive use in the main session; these do not affect the dev agents.

## Rules & hooks

Mechanics live in `.claude/rules/` (worktree-scope, agent-output-format, validation-commands, security-triggers). Hooks in `.claude/settings.json` / `.claude/hooks/` are `.mjs` ES modules.
