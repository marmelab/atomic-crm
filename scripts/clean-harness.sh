#!/usr/bin/env bash
#
# Clean up Atomic CRM agent-workflow session artifacts.
#
# Removes everything the SIMPLE/COMPLEX agent pipeline leaves behind:
#   - session git worktrees under /tmp/<repo-slug>/
#   - branches checked out in those worktrees, plus session/* and session-base/*
#   - the sessionbase.* git config keys recording each session's fork-base branch
#   - the .promote.lock promotion lock file
#   - the /tmp/<repo-slug> session directory tree
#
# It NEVER deletes the current branch, main, or any branch not tied to a
# session worktree.
#
# By default it also lands you back where you launched the harness from:
#   - checks out the branch you started on (a safety net, in case the harness or
#     a drifted session left you on a different branch),
#   - hard-resets that branch to the pre-harness commit (dropping every commit
#     the harness promoted onto it — promotion now targets the start branch, not
#     main),
#   - restores main to origin/main as a backstop (older sessions promoted onto
#     main; current sessions promote onto the start branch instead).
#
# The start branch + commit are read from .git/clean-harness-return, written by
# launch-harness.sh at launch (it survives the /tmp cleanup). If that record is
# missing, it falls back to the most recent session-base anchor and resets the
# current branch in place.
#
# Usage:
#   scripts/clean-harness.sh              # clean + reset to latest harness-start anchor
#   scripts/clean-harness.sh --no-reset   # clean session artifacts only, no reset
#   scripts/clean-harness.sh --dry-run    # print what would happen, change nothing
#
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

DRY_RUN=false
NO_RESET=false
RESET_REF=""
for arg in "$@"; do
  case "$arg" in
    --dry-run|-n) DRY_RUN=true ;;
    --no-reset)   NO_RESET=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
HEAD_SHA="$(git rev-parse HEAD)"

# Preferred target: the launch record written by launch-harness.sh, which captures
# the branch + commit you started from (the exact pre-harness anchor). It lives
# under .git/ so it survives the /tmp cleanup below.
RETURN_FILE="$REPO_ROOT/.git/clean-harness-return"
START_BRANCH=""
if [[ -z "$RESET_REF" ]] && ! $NO_RESET && [[ -f "$RETURN_FILE" ]]; then
  IFS=$'\t' read -r START_BRANCH RESET_REF < "$RETURN_FILE" || true
  if [[ -n "$RESET_REF" ]] && ! git rev-parse --verify --quiet "${RESET_REF}^{commit}" >/dev/null; then
    echo "Warning: recorded start commit ${RESET_REF:0:12} no longer exists; ignoring record." >&2
    RESET_REF=""
    START_BRANCH=""
  fi
fi

# Fallback target: the most recent harness-start anchor.
#
# setup-worktree.mjs records each harness run's starting point as a
# `session-base/<id>` branch pointing at HEAD before any agent work. We pick the
# anchor with the most commits in its history (= started latest) among those
# that are a STRICT ancestor of HEAD, so the agent commits stacked on top get
# dropped while pre-run history is kept.
if [[ -z "$RESET_REF" ]] && ! $NO_RESET; then
  best_count=-1
  while IFS= read -r ref; do
    [[ -z "$ref" ]] && continue
    sha="$(git rev-parse "$ref")"
    [[ "$sha" == "$HEAD_SHA" ]] && continue                       # not strict
    git merge-base --is-ancestor "$sha" "$HEAD_SHA" || continue   # must be ancestor
    count="$(git rev-list --count "$sha")"
    if (( count > best_count )); then
      best_count=$count
      RESET_REF="$sha"
    fi
  done < <(git for-each-ref --format='%(refname:short)' 'refs/heads/session-base/*')

  if [[ -z "$RESET_REF" ]]; then
    echo "Warning: no session-base anchor (strict ancestor of HEAD) found; skipping reset." >&2
    echo "         Use --no-reset to silence this." >&2
  fi
fi

# /tmp base: repo path with every "/" replaced by "_" (see worktree-scope rule).
SLUG="${REPO_ROOT//\//_}"
TMP_BASE="/tmp/${SLUG}"

say() { printf '%s\n' "$*"; }
do_run() {
  if $DRY_RUN; then
    say "[dry-run] $*"
  else
    "$@"
  fi
}

say "==> Repo:        $REPO_ROOT"
say "==> Tmp base:    $TMP_BASE"
say "==> Branch:      $CURRENT_BRANCH"
$DRY_RUN && say "==> Mode:        DRY-RUN (no changes)"

# 1. Collect branches checked out in /tmp session worktrees (before removal).
mapfile -t SESSION_WT_BRANCHES < <(
  git worktree list --porcelain | awk -v base="$TMP_BASE/" '
    /^worktree /   { wt = $2 }
    /^branch /     { sub("refs/heads/", "", $2); if (index(wt, base) == 1) print $2 }
  '
)

# 2. Remove every worktree under the tmp base.
say "==> Removing session worktrees..."
while IFS= read -r wt; do
  [[ -z "$wt" ]] && continue
  say "    - $wt"
  do_run git worktree remove --force "$wt"
done < <(git worktree list --porcelain | awk -v base="$TMP_BASE/" '/^worktree / && index($2, base) == 1 { print $2 }')
do_run git worktree prune

# 3. Delete session branches: those from /tmp worktrees + session/* + session-base/*.
say "==> Deleting session branches..."
{
  printf '%s\n' "${SESSION_WT_BRANCHES[@]:-}"
  git for-each-ref --format='%(refname:short)' refs/heads/session refs/heads/session-base 2>/dev/null || true
  git for-each-ref --format='%(refname:short)' 'refs/heads/session/*' 'refs/heads/session-base/*'
} | sort -u | while IFS= read -r br; do
  [[ -z "$br" ]] && continue
  [[ "$br" == "$CURRENT_BRANCH" ]] && { say "    ! skip current branch: $br"; continue; }
  if git show-ref --verify --quiet "refs/heads/$br"; then
    say "    - $br"
    do_run git branch -D "$br"
  fi
done

# 3b. Remove recorded session fork-base config keys (sessionbase.<short>.branch,
# written by setup-worktree.mjs and read by the promotion merger). Every session
# branch is being deleted above, so a stray key would only outlive its branch and
# accumulate in .git/config. `--get-regexp` exits non-zero with no matches, hence
# the `|| true` guard under `set -e`.
say "==> Removing session base-branch config keys..."
{ git config --local --get-regexp '^sessionbase\.' 2>/dev/null || true; } \
  | awk '{ sub(/\.branch$/, "", $1); print $1 }' \
  | sort -u \
  | while IFS= read -r subsection; do
      [[ -z "$subsection" ]] && continue
      say "    - $subsection"
      do_run git config --local --remove-section "$subsection" 2>/dev/null || true
    done

# 4. Remove the promotion lock.
if [[ -f "$REPO_ROOT/.promote.lock" ]]; then
  say "==> Removing .promote.lock"
  do_run rm -f "$REPO_ROOT/.promote.lock"
fi

# 5. Remove the /tmp session directory tree.
if [[ -d "$TMP_BASE" ]]; then
  say "==> Removing $TMP_BASE"
  do_run rm -rf "$TMP_BASE"
fi

# 6. Land back on the start branch + commit, and restore main.
if [[ -n "$RESET_REF" ]]; then
  # 6-pre. Safety net: never let the hard reset destroy uncommitted work. If the
  # working tree has tracked changes, stash them first so a surprise is always
  # recoverable with `git stash pop`. Untracked files are left alone (reset does
  # not touch them).
  if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
    say "==> Stashing uncommitted changes before reset (recover with: git stash pop)"
    do_run git stash push -m "clean-harness safety stash"
  fi

  # 6a. Switch off whatever the harness left us on (e.g. main) onto the branch
  # we started from.
  if [[ -n "$START_BRANCH" && "$START_BRANCH" != "$CURRENT_BRANCH" ]]; then
    if git show-ref --verify --quiet "refs/heads/$START_BRANCH"; then
      say "==> Checking out $START_BRANCH"
      do_run git checkout "$START_BRANCH"
    else
      say "    ! start branch '$START_BRANCH' no longer exists; staying on $CURRENT_BRANCH"
      START_BRANCH=""
    fi
  fi
  TARGET_BRANCH="${START_BRANCH:-$CURRENT_BRANCH}"

  # 6b. Restore main to origin/main (undo the merge the harness made on main),
  # unless main is the branch we are landing on.
  if [[ "$TARGET_BRANCH" != "main" ]] && git show-ref --verify --quiet refs/heads/main; then
    if git rev-parse --verify --quiet "origin/main^{commit}" >/dev/null; then
      say "==> Restoring main to origin/main"
      do_run git branch -f main origin/main
    else
      say "    ! origin/main not found; leaving main untouched"
    fi
  fi

  # 6c. Reset the start branch to the pre-harness commit.
  say "==> Resetting $TARGET_BRANCH to $RESET_REF"
  do_run git reset --hard "$RESET_REF"

  # 6d. Consume the launch record.
  if [[ -f "$RETURN_FILE" ]]; then
    do_run rm -f "$RETURN_FILE"
  fi
fi

say "==> Done."
