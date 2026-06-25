---
description: Revert a harness session's changes and clean up its branches/worktrees
---

Revert everything a harness session merged into your branch, then remove its temporary branches and worktrees. This is **destructive** — confirm before acting.

1. **Pick the session short id.**
   - If the user passed a short id as an argument (`$ARGUMENTS`), use it.
   - Else, look for a `<session_dir>…</session_dir>` value in your context. If present and `git show-ref --verify --quiet refs/heads/session/<short>` succeeds, that is the current session — use it.
   - Otherwise enumerate `git for-each-ref --format='%(refname:short)' 'refs/heads/session/*'`.
     - none → tell the user there is no harness session to revert, and stop.
     - exactly one → use it.
     - several → list them (short id + base branch via `git config --local --get sessionbase.<short>.branch` + fork date via `git --no-pager log -1 --format=%cr session-base/<short>`) and ask which with `AskUserQuestion`. Because this is destructive, **always** make the user choose explicitly when more than one exists — never silently pick the latest.

2. **Show what will be undone, then confirm.** Run `git --no-pager diff --stat session-base/<short>..session/<short>` and name the base branch it landed on. Then ask the user to confirm with `AskUserQuestion` (yes / no). Do not proceed without an explicit yes.

3. **On confirmation, run the script** from the repo root:
   ```
   node "$(git rev-parse --show-toplevel)/scripts/harness-revert.mjs" <short>
   ```
   (Run it once with `--dry-run` appended first if you want to preview the exact git actions.) Relay the script's output to the user. It reverts this session's promotion merge commit(s) — safe even if other sessions landed on the same branch — then removes the session's worktrees, branches, `sessionbase.<short>` config, and `/tmp` dir.

4. **If the script reports a conflict**, tell the user which step stopped and that another session likely touched the same files; they must resolve it manually before re-running. Never force the revert.
