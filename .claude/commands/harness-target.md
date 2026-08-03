---
description: Point this harness session's fork base + promotion target at a branch (worktree workflows where $CLAUDE_PROJECT_DIR stays on main)
---

Pre-seed the branch the harness forks from and promotes onto, so a code-change dispatch lands on the branch you are actually working on — e.g. a `feat/...` checked out in a **separate worktree** while `$CLAUDE_PROJECT_DIR` stays on `main`. You name only the **branch**; the merger finds whichever worktree has it checked out.

1. **Resolve the target branch** from `$ARGUMENTS` (e.g. `feat/us-05`). If empty, ask the user which branch, then stop.

2. **Resolve the session short id** from the `<session_dir>…</session_dir>` value in your context: `<short>` = the first dash-segment of its basename. If there is no `session_dir`, tell the user and stop.

3. **Validate the branch exists locally**: `git show-ref --verify --quiet "refs/heads/<branch>"`. If it does not, show `git worktree list` and stop — never create the branch here.

4. **Refuse if the session already forked.** If `git config --local --get sessionbase.<short>.branch` is already set, or `git show-ref --verify --quiet refs/heads/session/<short>` succeeds, the fork base is already pinned for this session. Overwriting now would change only the promotion target, not the work already forked from the old base — an inconsistent state. Warn the user and ask with `AskUserQuestion` before overwriting; recommend a fresh session (or `/harness-revert` first) instead.

5. **Set it**: `git config --local "sessionbase.<short>.branch" "<branch>"`. Confirm: for this session the harness will fork from and promote onto `<branch>`, and the merger merges inside that branch's worktree.

Run this **before** the first code-change request of the session (the base is pinned at the first developer dispatch). Effective only with the worktree-aware `getBaseBranch` / merger changes present.
