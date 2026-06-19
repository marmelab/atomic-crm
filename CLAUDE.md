@AGENTS.md

# Agent Workflow

Once a plan is approved (`ExitPlanMode`), the main thread does not implement directly — it routes to the agents in `.claude/agents/` (each carries its own full contract). Trigger is *plan approved*, not task size.

## Opting out

Harness routing is the **default**. `#no-harness` (or "implement directly" / "without the agent team" / "skip harness") makes the main thread implement itself, no agents, even after plan approval. "no-harness for this session" keeps it off all session. Irrelevant under `make harness` (orchestrator always routes).

## Routing

- **SIMPLE** (1 cosmetic edit, OR 1 single-field change on an existing entity, OR 1 filter reusing existing components) → simple-developer → merger. No team, no review.
- **COMPLEX** (everything else) → planner → wave → review → merge pipeline below.

## COMPLEX pipeline

planner (tickets JSON + waves) → developer per ticket (implements + commits in a worktree; no SQL migrations, deploy-time only) → quality-reviewer (code + security + QA) → merger (`git merge --no-ff` only) → documentator (appends to `MEMORY.md`). Agents run as **foreground** subagents in one synchronous turn; each agent's last line is an output contract the orchestrator parses (`.claude/rules/agent-output-format.md`).

## Agents

chat-orchestrator (routes, narrates), planner, developer, simple-developer, quality-reviewer, merger, documentator. Models/roles: see each `.claude/agents/*.md`.

## Rules & hooks

Mechanics live in `.claude/rules/` (worktree-scope, agent-output-format, validation-commands, security-triggers, graphify-navigation). Hooks in `.claude/settings.json` / `.claude/hooks/` are `.mjs` ES modules.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost). This is the main thread's job — ticket agents navigate the graph read-only and never run `update` inside a worktree (it would pollute the ticket diff and collide across parallel worktrees). See `.claude/rules/graphify-navigation.md`.
