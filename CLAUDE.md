@AGENTS.md

# Agent Workflow

Code-change requests can run through the **agent harness**: subagents (planner, developer,
quality-reviewer, merger, documentator) implementing the change via a deterministic
foreground pipeline in git worktrees, under hook enforcement. **Opt-in, off by default;**
otherwise the main thread implements the change itself.

The harness is **not in this repo**. It ships as the `aiharness` Claude Code plugin
(<https://github.com/marmelab/AIHarness>), declared in `.claude/settings.json`
(`extraKnownMarketplaces` + `enabledPlugins`). Its hooks, agents, rules, commands and
generic skills come from there; this repo supplies only the project layer:

- **`harness.config.json`** — the contract the plugin reads: validation steps, roles,
  allowed containers, the Supabase deploy adapter, the app smoke command, the launcher
  extension points, and the developer skill menu.
- **`.claude/skills/`** — the domain skills (`frontend-dev`, `backend-dev`,
  `shadcn-customization`, `delete-initial-resource`, `update-branding`).
- **`.claude/settings.json`** — permissions, env, plugin declarations.

The plugin's `HARNESS-SPLIT.md` documents which layer owns what, and why.

## Opting in

`#harness` (or "use the agent team" / "with the harness") routes a request through the
orchestrator; "harness for this session" keeps it on all session. `#technical-harness` is
the same opt-in with the full technical register, and it stops at the session branch
without promoting.

A request may carry `gate=none|migration|plan|waves`, default **`plan`**: it pauses after
planning so you review the real tickets, and stops before applying a database migration.

For a vague or broad `#harness` request, run `Skill({skill: "grill-me"})` first and fold
the answers into the dispatch: the planner never questions, and `gate=plan` only reacts
after a plan already exists.

**"Launched" is not "done".** Some runtimes return `Async agent launched … agentId: <id>`
immediately and deliver the result later as a `task-notification`. That ack means
dispatched, not finished: do not fill the silence by implementing the feature yourself or
re-dispatching. Surface progress, then relay the final report.

## Where things are

| What | Where |
|---|---|
| Hooks, agents, rules, commands, generic skills | the `aiharness` plugin |
| Project contract | `harness.config.json` |
| Domain skills | `.claude/skills/` |
| Deploy adapter (Supabase migrations, isolated e2e) | the plugin's `adapters/supabase` |
| Live board for a `#technical-harness` run | `<repo>/.harness/<SESSION_SHORT_ID>/` |

To upgrade the harness, bump the plugin. To change what validation runs, or which
containers the agents may start, edit `harness.config.json` — never a command string in a
hook.
