# Aparna's English Coaching CRM — planning pack

**Status:** Index. Binds nothing by itself.

## Reading order (for humans and for Claude)

1. `CLAUDE-aparna.md` — project facts (also auto-loaded via root `CLAUDE.md`).
2. `MVP.md` — **current track**: the 1-week "never lose a lead" MVP (scope, slices M0–M5, file ownership).
3. `TRANSITION.md` — every MVP shortcut, point by point, and how the full build pays it back.
4. `PRD.md` — the full build: what and why (problem, metrics, roles, flows, rules, screens).
5. `ARCHITECTURE.md` — how (schema, RLS, edge functions, outbox, integrations, tests, deploy).
6. `project_plan.md` — order (phase graph, slices, gates, the per-slice loop).
7. `features.json` — the definition of done (machine-checkable; only `passes` changes).
8. `decisions.md` — ADRs (LAW once Accepted). `risks.md` — named risks. `problems.md` — what went wrong and how it was encoded.
9. `progress.md` — latest session handoff. `CHANGELOG.md` — our changes.
10. `KICKOFF.md` — environment manual for Claude Code online + copy-paste prompts per slice.

## Claude layer added to this repo

| File | Layer | Purpose |
|---|---|---|
| `CLAUDE.md` (one import line) | Memory | Loads `docs/aparna/CLAUDE-aparna.md` every session |
| `docs/aparna/CLAUDE-aparna.md` | Memory (editable) | Facts, gotchas, Mistakes Log — updated by encode-the-fix |
| `.claude/rules/karpathy.md` | Rule | Think first, simplicity, surgical changes, goal-driven verification |
| `.claude/skills/aparna-loop/` | Skill | Session START (orient + checks) and CLOSE (evidence, logs, commit) |
| `.claude/agents/gate-reviewer.md` | Subagent | Fresh-context cold reads for gates, plans, weekly audits |

Everything else (orchestrator, planner, developer, quality-reviewer, merger, documentator, validation hooks, ponytail YAGNI skills, ADR skill) is upstream and reused as-is (ADR-A02).

## How the best Claude Code users build something like this (what this pack encodes)

1. **Explore → plan → code → commit.** Plan mode first; pour effort into the plan so the build can be one-shot. → `project_plan.md` §5, `KICKOFF.md`.
2. **Give Claude a way to verify its work.** The single biggest quality lever. → `verify` on every feature, pgTAP/Vitest/Playwright, evidence pasted.
3. **A living, shared CLAUDE.md.** Every time Claude is corrected, a line is added; reviewed like code. → `CLAUDE-aparna.md` + encode-the-fix in `aparna-loop` CLOSE.
4. **Fresh-context review.** Claude A plans or builds, Claude B reviews with only the files. → `gate-reviewer`, upstream `quality-reviewer`.
5. **Externalised memory for long builds.** A JSON feature list the agent may only flip, a progress file, and git history as the handoff between sessions. → `features.json`, `progress.md`, `aparna-loop` START.
6. **Loops with stop conditions.** Hand off the stop condition with `/goal`, with a deterministic, transcript-provable finish line and a turn cap. → Prompt 2.
7. **Hooks for anything that must hold 100%.** Prompts and docs enforce nothing. → upstream hooks, DB constraints, RLS; risk R-1.
8. **Graph of loops.** Start with one loop; wrap working loops in an explicit dependency graph with human gates; parallel only where contracts are frozen. → phase graph.
9. **Simplicity (Karpathy, YAGNI).** → `.claude/rules/karpathy.md`, upstream ponytail skills, PRD non-goals.
10. **Encode failures into the system, not the instance.** → `problems.md` "encoded as" column.

## Sources

- Claude Code best practices: https://code.claude.com/docs/en/best-practices
- `/goal` docs: https://code.claude.com/docs/en/goal
- Effective harnesses for long-running agents: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- Claude Code power-user tips (Claude Code team): https://support.claude.com/en/articles/14554000-claude-code-power-user-
- Practical loop engineering (Addy Osmani): https://addyosmani.com/blog/practical-loop-engineering/
- Boris Cherny's workflow (summary): https://www.infoq.com/news/2026/01/claude-code-creator-workflow

## Provenance & audit
Checked: every file in the reading order exists in this folder; the Claude layer table matches files committed in this branch.
