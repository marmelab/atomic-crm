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

2. **Show what will be undone, then confirm — including the strategy.** Run `git --no-pager diff --stat session-base/<short>..session/<short>` and name the base branch it landed on. Ask the user to confirm with `AskUserQuestion`, offering the two strategies (default unless the user already said which):
   - **revert** (default, safe): keeps history, adds a revert commit; safe even if other sessions landed on the same branch afterwards.
   - **hard** (clean history): `git reset --hard` to the session's fork point — the session's commits disappear entirely (no merge, no revert commit), but anything else committed after the fork is also dropped. Best when this session is the only thing on the branch (e.g. demos). If the user asked to "completely remove the branch / drop the commits / clean history", pick this.
   **Before offering hard, preview the collateral.** Run `git --no-pager log --oneline session-base/<short>..HEAD`: these are ALL commits `--hard` would drop, not just the session's. If any are unrelated to the session (e.g. the user's own commits made after the session forked, common for a `#technical-harness` run, which never promotes onto the base branch so its work is not even there), warn explicitly that hard would delete them too, and steer to **revert** (or, for a non-promoted session, note that default mode cleans up branches/worktrees without touching the base branch at all). The script enforces this: `--hard` refuses when such collateral exists unless `--force`.
   Do not proceed without an explicit yes.

3. **On confirmation, run the script** from the repo root (append `--hard` for the clean-history strategy):
   ```
   node "$(git rev-parse --show-toplevel)/.claude/scripts/harness-revert.mjs" <short> [--hard] [--force]
   ```
   If `--hard` refuses because it would drop commits not belonging to the session, do NOT reflexively add `--force`; relay the listed commits to the user and re-confirm; `--force` bypasses the guard and permanently drops them.
   (Run it once with `--dry-run` appended first if you want to preview the exact git actions.) Relay the script's output. Default mode reverts this session's promotion merge commit(s) (safe even if other sessions landed on the same branch); `--hard` resets the base branch to the fork point (refuses if history diverged). Either way it then removes the session's worktrees, branches, `sessionbase.<short>` config, and `/tmp` dir.

4. **If the script reports a conflict**, tell the user which step stopped and that another session likely touched the same files; they must resolve it manually before re-running. Never force the revert.
