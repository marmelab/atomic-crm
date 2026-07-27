---
paths:
  - "**/*"
---

# Git policy for agents

The user owns the REMOTE and the promotion of shared history. Agents never push,
pull, or force-push. What an agent MAY do LOCALLY depends on its role and is scoped
to its own worktree / branch.

## Developer / simple-developer - commit your OWN task branch (required)

Building your task branch IS the mechanism the reviewer reads and the merger merges,
so you MUST commit. Allowed, scoped to `<WORKTREE_PATH>` on `BRANCH_NAME`:

- `git add`, `git commit` - atomic commits, subject `feat(TASK-XXX):` / `fix(TASK-XXX):`
- `git rebase session/<SESSION_SHORT_ID>` - rebase your OWN branch onto the session
  branch (NEVER onto the base branch: that pulls other sessions' work into yours)
- `git status` / `git diff` / `git log` / `git branch` / `git stash`

Not allowed: committing on the base branch / `session/<id>` / `main`; `git push` /
`git pull`; force-push; `git reset --hard` onto a shared ref.

## Merger - the ONLY agent that mutates shared branches

Merging task branches into `session/<id>`, promoting `session/<id>` into the base
branch under `.promote.lock`, and the promotion-lock command set in MIGRATION / PROMOTE
mode (including the destructive git ops the lock needs) ARE its job. See `merger.md`.

## quality-reviewer / planner / orchestrator / documentator - read-only git

`git diff` / `status` / `log` / `branch --show-current` / `git fetch` (read) /
`git stash`. No `commit` / `rebase` / `merge` / `push` / `pull` / `reset` / branch
`checkout`.

## Never (any role)

`git push`, `git pull`, force-push, or any write to the remote. The user owns the
remote and the base branch.
