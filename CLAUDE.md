@AGENTS.md

# Agent Workflow

Once a plan is approved (`ExitPlanMode`), the main thread does not implement directly — it routes to the agents in `.claude/agents/` (each carries its own full contract). Trigger is *plan approved*, not task size.

## Opting out

Harness routing is the **default**. `#no-harness` (or "implement directly" / "without the agent team" / "skip harness") makes the main thread implement itself, no agents, even after plan approval. "no-harness for this session" keeps it off all session. Irrelevant under `make harness` (orchestrator always routes).

## Routing: one pipeline for every change

The **chat-orchestrator** is the user-facing entry point. It routes, narrates progress, and never implements. There is **no SIMPLE-vs-COMPLEX triage**: every request that changes the CRM code or schema — a one-line label rename just as much as a new entity with relations — runs the **same pipeline** below. A tiny change is simply a one-ticket wave. The orchestrator only branches away from this pipeline for non-code operational intents: SETUP (project scoping), MODE-SWITCH (demo/real data), MEMORY (capture a pattern), ROLLBACK-CONFLICT (resolve a failed automatic revert), and RECOVERY (resume after an interruption).

## The pipeline

planner (tickets JSON + waves) → developer per ticket (implements + commits in a worktree; no SQL migrations, deploy-time only) → quality-reviewer (code + security + QA) → merger (`git merge --no-ff` only; Stage A per ticket, then one `MODE: promote` to the base branch under `flock`) → documentator (appends to `MEMORY.md`). Agents run as **foreground** subagents in one synchronous turn; each agent's last line is an output contract the orchestrator parses (`.claude/rules/agent-output-format.md`).

## Agents

chat-orchestrator (routes, narrates), planner, developer, quality-reviewer, merger, documentator. Models/roles: see each `.claude/agents/*.md`. **planner** and **quality-reviewer** run on opus; everything else is sonnet or haiku.

The **developer** is a single agent with no modes: it implements the ticket in `TICKET_FILE` (peer-reviewed, writes ADRs for structural decisions, never writes SQL during tickets). Two session-level operations are handed to it as **skills** loaded on dispatch, run on the shared `<base>/ops` worktree: `writing-migrations` (deploy-time SQL generation) and `resolving-rollback-conflicts` (replay merge-commit reverts). It applies the **Ponytail** minimization ladder (full mode) on every change via an inline prompt directive — the only mechanism that reaches `Agent`-dispatched subagents. Ponytail is also installed natively in-repo as on-demand skills (`.claude/skills/ponytail*`) and `/ponytail*` commands for interactive use in the main session; these do not affect the dev agents.

## Rules & hooks

Mechanics live in `.claude/rules/` (worktree-scope, agent-output-format, validation-commands, security-triggers). Hooks in `.claude/settings.json` / `.claude/hooks/` are `.mjs` ES modules.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
