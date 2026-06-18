# Worktree scope — strict file access for ticket work

Applies to: developer, quality-reviewer. Any agent dispatched by the orchestrator (background, single-shot) to work on a specific ticket, with a suffixed name (e.g. `developer-TASK-006`).

Throughout this rule, `$REPO` is the project root (`$CLAUDE_PROJECT_DIR` — wherever the repo is checked out). `<WORKTREE_PATH>` is the absolute worktree path handed to you in your spawn prompt.

Not applicable to: planner (searches `$REPO/src/` for file discovery), merger (operates in `$REPO` to merge), chat-orchestrator (doesn't touch files), project-manager (operates on `$REPO/docs/project-context.json` directly on main — config only, no code), documentator (writes `$REPO/MEMORY.md` directly on main in Mode 2; never touches application code).

Developer ADRs follow the standard worktree rule: write `<WORKTREE_PATH>/adr/ADR-<SESSION_SHORT_ID>-<TASK-XXX>-<slug>.md` inside your worktree, commit alongside the implementation, the merger ships it to `$REPO/adr/` like any other change. See `Skill({skill: "adr-writing"})` for the full rules and template.

## Why

Each ticket gets its own git worktree under a session-scoped base, `<WORKTREE_BASE>/TASK-XXX/`, where `<WORKTREE_BASE>` is `/tmp/<$REPO with every "/" replaced by "_">/<SESSION_ID>` (session-scoped to prevent stale worktrees from a previous stopped session from interfering). Reading/editing `$REPO/src/...` while you have the same file at `<WORKTREE_PATH>/src/...` is:

1. Duplicate work — same bytes, twice the token cost
2. Incorrect — `$REPO` is on the base branch, missing the ticket's changes
3. Dangerous — editing `$REPO/src/App.tsx` pollutes the base branch with changes outside the ticket's scope. This happened in a past session and left 20+ files uncommitted on the base branch.

## Session-branch topology

Each session owns an integration branch `session/<SESSION_SHORT_ID>` (forked from the repo's base branch at session start) and a fixed anchor ref `session-base/<SESSION_SHORT_ID>`. `SESSION_SHORT_ID` is the first dash-segment of the full session id. Task worktrees fork from `session/<SESSION_SHORT_ID>`. The merger merges task branches into the session branch inside the dedicated `<WORKTREE_BASE>/_session` worktree, then promotes `session/<SESSION_SHORT_ID>` into the base branch once per request under `$REPO/.promote.lock`.

- Developers rebase onto `session/<SESSION_SHORT_ID>`, never onto the base branch directly.
- The `_session` worktree is the merger's; developers/reviewers never touch it.
- Only a `promotion-conflict-resolver` developer may edit `$REPO` on the base branch, and only to resolve a `session->base` merge conflict under the lock.

## Allowed paths

| Path prefix | Read | Write/Edit | Bash cwd |
|---|---|---|---|
| `<WORKTREE_PATH>/**` (i.e. `<WORKTREE_BASE>/TASK-XXX/`) | ✅ | ✅ | ✅ |
| `${TICKETS_DIR}/TASK-XXX.json` (per-session folder passed in your prompt) | ✅ (ticket source of truth) | ⚠️ merger writes the `status` field — no other writes | — |
| `$REPO/adr/**` | ✅ (learn from past structural decisions) | ❌ (developer writes ADRs inside the worktree at `<WORKTREE_PATH>/adr/`; the merger ships them to `$REPO/adr/`) | — |
| `~/.claude/**` (`$CLAUDE_CONFIG_DIR`) | ✅ (skills, rules) | ❌ | — |

Everything else under `$REPO/` — `$REPO/src/`, `$REPO/e2e/`, `$REPO/supabase/`, `$REPO/package.json`, `$REPO/*.ts`, `$REPO/*.json` — is **off-limits**. If you need information from these, read the copy inside your worktree.

## Bash — every call needs `cd`

Bash tool invocations are **stateless shells**. `cd <WORKTREE_PATH>` in one call does NOT persist to the next — the next call starts again in `$REPO` by default.

**Mandatory prefix for every Bash when working inside a worktree:**

```bash
cd <WORKTREE_PATH> && <your command>
```

`WORKTREE_PATH` is provided in your spawn prompt (e.g. `/tmp/_home_user_code_atomic-crm/46bc14c5-.../TASK-XXX`).

## Violation examples

```
Read("$REPO/src/components/atomic-crm/types.ts")
```
❌ The worktree has this file at `<WORKTREE_PATH>/src/components/atomic-crm/types.ts`. Read there instead.

```
Bash("npm run typecheck")
```
❌ Runs in `$REPO` (default cwd), not your worktree. Use `Bash("cd <WORKTREE_PATH> && npm run typecheck")`.

```
Edit("$REPO/src/App.tsx", ...)
```
❌ Never edit inside `$REPO/`. Always your worktree. If `App.tsx` genuinely belongs to the ticket, edit `<WORKTREE_PATH>/src/App.tsx`.

```
Bash("npm run prettier:apply")
```
❌ No `cd` prefix → runs in `$REPO`, reformats the base branch. Use `Bash("cd <WORKTREE_PATH> && npm run prettier:apply")`.

## When you genuinely need `$REPO` state

You (almost) never do. Specific exceptions:
- Reading the ticket JSON: `Read("${TICKETS_DIR}/TASK-XXX.json")` — source of truth, read-only. `TICKETS_DIR` is the absolute per-session path passed in your prompt; substitute the literal value.
- Reading past ADRs: `Read("$REPO/adr/ADR-<SESSION_SHORT_ID>-<TASK-XXX>-<slug>.md")` (research)

If you think you need something else from `$REPO/`, stop and flag it to the caller. Do not silently edit `$REPO/` or run commands there.
