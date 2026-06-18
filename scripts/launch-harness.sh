#!/usr/bin/env bash
#
# Launch the chat-orchestrator agent locally
#
#
# Usage:
#   scripts/launch-harness.sh ["CRM change request"]
#   MODE=full scripts/launch-harness.sh "..."     # real backend (needs local Supabase up)
#
# The request is optional: pass it to pre-fill the first message, or omit it and
# type your request once the session opens.

set -euo pipefail

# Capture the optional request before we touch the positional parameters.
REQUEST="$*"

# Run from the repo root so CLAUDE_PROJECT_DIR and the hook-computed worktree
# paths line up.
REPO="$(git rev-parse --show-toplevel)"
cd "$REPO"

# Record the branch + commit we start from so `make clean-harness` can land us
# back here afterwards. The harness checks out main to promote merged work, which
# would otherwise leave you stranded on main with your branch behind. Stored
# under .git/ so it survives the /tmp session cleanup. Detached HEAD → empty
# branch field (clean-harness then just resets in place).
START_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || true)"
START_SHA="$(git rev-parse HEAD)"
printf '%s\t%s\n' "$START_BRANCH" "$START_SHA" > "$REPO/.git/clean-harness-return"

# Mint a fresh session id and build the session dir from it. The hooks
# (setup-worktree, merger, ...) derive the worktree base from the process's real
# session id, while the orchestrator derives WORKTREE_BASE from
# basename(session_dir) -- they only agree when basename(session_dir) == the
# session id, hence --session-id below points at the same UUID.
UUID="$(uuidgen 2>/dev/null | tr 'A-Z' 'a-z' || cat /proc/sys/kernel/random/uuid)"
SAN="$(printf '%s' "$REPO" | sed 's#/#_#g')"
SESSION_DIR="/tmp/atomic-crm-harness/${UUID}"
mkdir -p "$SESSION_DIR"

MODE="${MODE:-demo}"

echo "Harness session"
echo "  mode:          $MODE"
echo "  session id:    $UUID"
echo "  session dir:   $SESSION_DIR"
echo "  worktree base: /tmp/${SAN}/${UUID}   (created lazily by the setup-worktree hook)"
echo "  hooks log:     /tmp/${SAN}/${UUID}/hooks.log"
echo

# Build the claude argument list. The request, if any, is passed as the first
# message (positional prompt); otherwise the session starts blank.
ARGS=(
  --agent chat-orchestrator
  --session-id "$UUID"
  --permission-mode auto
  --append-system-prompt "<mode>${MODE}</mode>
<session_dir>${SESSION_DIR}</session_dir>"
)
if [ -n "$REQUEST" ]; then
  ARGS+=("$REQUEST")
fi

exec env \
  CLAUDE_PROJECT_DIR="$REPO" \
  CHAT_SESSION_DIR="$SESSION_DIR" \
  MODE="$MODE" \
  DISABLE_AUTOUPDATER=1 \
  CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1 \
  claude "${ARGS[@]}"
