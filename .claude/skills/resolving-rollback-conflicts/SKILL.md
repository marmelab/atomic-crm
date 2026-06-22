---
name: resolving-rollback-conflicts
description: Replay a list of git-revert commits against the current base branch and resolve the conflicts, when the chat-service's automatic rollback hit a merge conflict it couldn't resolve. Load this when your developer dispatch asks you to resolve a rollback conflict (it carries BASE_BRANCH, FAILED_COMMIT, COMMITS_TO_REVERT). This is NOT a feature ticket — the workflow below replaces the normal ticket rules.
---

# Resolving rollback conflicts

The chat-service's HTTP `/rollback` route attempted to `git revert -m 1 <sha>` each merge commit on the base branch, and one of them conflicted. It aborted that revert and handed you the failed commit plus every commit it still had left to undo. Your job: replay them **against the current base branch**, resolving conflicts as you go. You are dispatched **alone** — no team, no peers. The merger is dispatched separately by the orchestrator after you stop.

The conflict exists because a *later* session edited the same lines this rollback wants to undo. That conflict only shows up against the current base branch — not against the stale `session/<SESSION_SHORT_ID>` your worktree was forked from. So your **first** step realigns your branch onto `BASE_BRANCH`; then the revert reproduces the real conflict for you to resolve, and the merger's promotion fast-forwards cleanly afterward.

## Spawn prompt — what you receive

```
ROLE: developer
WORKTREE_PATH: <WORKTREE_BASE>/simple
BRANCH_NAME: <SESSION_SHORT_ID>/simple
BASE_BRANCH: <the default branch, e.g. master — the promotion target>
FAILED_COMMIT: <short sha> ("<subject>")
COMMITS_TO_REVERT:
  - <sha>    # <subject>
  - ...
```

**Working directory is `<WORKTREE_PATH>`** — the shared `<base>/simple` worktree the `setup-worktree` hook creates for you. Every Bash call must `cd <WORKTREE_PATH> && …` (shell state is stateless between calls). Do NOT touch `$CLAUDE_PROJECT_DIR/src/...` — that's the base branch.

## Output contract

Your very last line of output MUST be exactly one of:

- `DONE: branch=<SESSION_SHORT_ID>/simple files=[<every file you touched, deduped>]`
- `FAILED: <one-line, plain-English reason — say what was confusing>`

The orchestrator's STATE RB-MERGE relies on those literal prefixes.

## Workflow

### Step 0 — Realign your branch onto the base branch (do this ONCE, first)

Your worktree was forked from the stale `session/<SESSION_SHORT_ID>`, where the conflicting later changes don't exist — revert there and it applies cleanly but the conflict resurfaces, unresolved, at promotion. Reset your branch onto the current base branch so you replay the reverts against the exact state the HTTP route hit the conflict on:

```bash
cd <WORKTREE_PATH> && git reset --hard <BASE_BRANCH>
```

This is the only branch-moving command you may run, and only here. After it, proceed to the loop below.

Then, for each SHA in `COMMITS_TO_REVERT`, in the order given:

### Step 1 — Read the commit you're about to undo

Before touching anything, get the canonical record of what this commit changed. This is the **ground truth** you'll use to resolve conflicts and to interpret empty reverts:

```bash
cd <WORKTREE_PATH> && git show --stat <sha>          # which files, how big
cd <WORKTREE_PATH> && git show <sha>                  # full diff
```

Read the diff. Identify, in your head, **exactly** what this commit added (the `+` lines on the "after" side) and what it replaced (the `-` lines). The revert's job is to remove the `+` and put back the `-` — nothing else.

### Step 2 — Attempt the revert

```bash
cd <WORKTREE_PATH> && git revert --no-edit -m 1 <sha>
```

Three possible outcomes — match yours below.

### Outcome A — Clean revert with real changes

`git revert` exited 0 AND `git diff --name-only HEAD^ HEAD` is non-empty. Sanity-check: do the changed files / changed lines match what Step 1 told you to expect? If yes, go to next SHA.

### Outcome B — Empty revert (clean exit, zero changes)

`git revert` exited 0 BUT `git diff --name-only HEAD^ HEAD` is empty.

This means a later commit on the base branch has **already removed or transformed** the lines your target commit added. Two sub-cases:

- **B1 — Pure substitution** (e.g. target said `X → Y`, current main says `Z`): the user's intent — "undo X → Y" — can sometimes still be expressed as `Z → X`. Look at Step 1's `+` strings; grep current main for them; if they're absent but the file at the same location now has a different value, that's the later commit's overwrite. Edit the file to replace that later value with the original `-` strings from Step 1. Then commit **with the revert marker** so a future rollback knows this commit was already undone:
  ```bash
  cd <WORKTREE_PATH> && git add -A && git commit -m "revert: semantic revert of <sha-short>" -m "This reverts commit <FULL 40-char sha>."
  ```
  The second `-m` line is mandatory: the chat-service detects already-reverted commits by scanning for `This reverts commit <sha>`. Native `git revert` / `git revert --continue` write this marker automatically; a manual semantic revert must add it explicitly or the commit will be re-reverted on the next rollback. Re-check with `git diff --name-only HEAD^ HEAD` — it should be non-empty now.
- **B2 — Target already fully absent** (the later commit removed the addition entirely, no equivalent value to swap): the target commit's effect is already gone from main. Nothing to revert.
  ```bash
  cd <WORKTREE_PATH> && git reset --hard HEAD^
  ```
  ```
  FAILED: revert of <sha> produced no changes — its additions have already been removed by a later commit
  ```

If you're unsure which sub-case applies, prefer B2 (FAILED) — a confusing-but-honest failure is better than a hallucinated edit that touches files the user didn't expect.

### Outcome C — Conflict (non-zero exit, unmerged paths)

`git status` shows `You are currently reverting commit <sha>` plus `UU`/`AA`/`DU`/`UD` entries.

```bash
cd <WORKTREE_PATH> && git status --porcelain
cd <WORKTREE_PATH> && git diff --diff-filter=U
```

For each conflict file, the markers look like:

```
<<<<<<< HEAD
<current state on the base branch — includes whatever later commits added>
=======
<state after applying the revert — the target commit's additions are removed,
 but later commits' additions on the SAME lines might also be missing here>
>>>>>>> parent of <sha>...
```

**Goal**: produce a version where the target commit's `+` lines (from Step 1) are removed, but **every** later commit's contribution that you can identify is preserved.

Heuristic, in order:

1. **Read both sides side-by-side**. Identify which lines come from the target commit's `+` (look at Step 1's diff) and which come from later commits.
2. **Keep**: everything on the "HEAD" side that does NOT correspond to one of the target commit's `+` lines.
3. **Drop**: the target commit's `+` lines (and only those).
4. If the target commit added a whole new function/file/component that's now referenced elsewhere, you'll need to also remove those references — but only the references that exist *because* of the target commit. The `SubagentStop` hooks (typecheck, unit tests, e2e) run after you stop; if they fail with `Cannot find name 'X'` for some `X` that the target commit introduced, that's your signal to remove the reference. If they fail for something the target commit DIDN'T introduce, you went too far — revert your last edit.

After resolving every conflict file:

```bash
cd <WORKTREE_PATH> && git add -A && git revert --continue --no-edit
```

Then re-check `git diff --name-only HEAD^ HEAD`. If empty, apply the Outcome B logic. Otherwise, go to next SHA.

### Step 3 — All SHAs processed

Emit the output contract:

```
DONE: branch=<SESSION_SHORT_ID>/simple files=[<every file you touched, deduped>]
```

The orchestrator's STATE RB-MERGE will dispatch the single-shot merger to merge your branch back into the base.

### Step 4 — Unrecoverable failure

If at any point you can't make progress (a conflict you genuinely can't read, three rounds of validation hook failures with no fix in sight, etc.):

```bash
cd <WORKTREE_PATH> && git revert --abort 2>/dev/null || true
```
```
FAILED: rollback merge failed: <one-line, plain-English reason — say what was confusing>
```

## NEVER while resolving a rollback conflict

- ❌ Run `git merge`, `git push`, `git checkout`, `--no-verify`. The only branch-moving commands allowed are: `git reset --hard <BASE_BRANCH>` exactly once at Step 0, and `git reset --hard HEAD^` to undo your own empty revert as documented in Outcome B.
- ❌ Edit anything outside `<WORKTREE_PATH>/`. Never edit `$CLAUDE_PROJECT_DIR/...` directly, never edit `.git/` internals.
- ❌ Drive-by refactors, prettier formatting changes, or unrelated edits. Edits must be **caused** by the revert (target additions to remove) or by a typecheck/unit/e2e failure that the revert created.
- ❌ Dispatch agents or `SendMessage` — you are solo here.
- ❌ Stop without either `DONE:` or `FAILED:` — the orchestrator's STATE RB-MERGE relies on those literal prefixes.
