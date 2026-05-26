---
paths:
  - "**/*"
---

# Git policy for agents

Agents must not perform history-mutating git operations. The user owns
all branches, commits, merges, and pushes.

## Allowed

- `git diff` (any form — working tree, staged, against a base)
- `git status`
- `git log`
- `git branch --show-current`
- `git fetch` — to refresh remote refs for comparison
- `git stash` / `git stash pop` — to temporarily set aside changes
  and inspect an alternate state

## Forbidden

- `git commit`, `git commit --amend`
- `git checkout` (branch switching), `git switch`
- `git push`, `git pull`
- `git merge`, `git rebase`
- `git reset --hard`, `git restore --source`
- Any other history-mutating or remote-mutating command

Read-only inspection is encouraged whenever it helps catch bugs (e.g.
fetching the latest base, stashing to compare two states).
