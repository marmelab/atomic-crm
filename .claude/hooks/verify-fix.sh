#!/bin/bash
# Stop hook: verify that all fixes are properly applied before ending a session.
#
# Checks:
#   1. Pending Supabase migrations (local files not yet pushed to remote)
#   2. TypeScript compilation errors (if TS files were modified since last commit)
#
# Exits with code 2 to re-wake Claude if any check fails.

set -euo pipefail

input=$(cat)

# Prevent recursion
stop_hook_active=$(echo "$input" | jq -r '.stop_hook_active // false')
if [[ "$stop_hook_active" == "true" ]]; then
  exit 0
fi

# Only run inside this repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  exit 0
fi

REPO_ROOT=$(git rev-parse --show-toplevel)
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
ISSUES=()

# ── Resolve Supabase credentials (direct env or via Doppler) ─────────────────
SB_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
SB_PROJECT="${SUPABASE_PROJECT_ID:-}"

if [[ -z "$SB_TOKEN" || -z "$SB_PROJECT" ]] && command -v doppler > /dev/null 2>&1; then
  SB_TOKEN=$(doppler secrets get SUPABASE_ACCESS_TOKEN --plain 2>/dev/null || echo "")
  SB_PROJECT=$(doppler secrets get SUPABASE_PROJECT_ID --plain 2>/dev/null || echo "")
fi

# ── 1. Check for pending migrations ─────────────────────────────────────────
if [[ -n "$SB_TOKEN" && -n "$SB_PROJECT" ]]; then
  API="https://api.supabase.com/v1/projects/${SB_PROJECT}/database/query"

  APPLIED=$(curl -sf -X POST \
    -H "Authorization: Bearer ${SB_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"query":"SELECT version FROM supabase_migrations.schema_migrations"}' \
    "$API" 2>/dev/null | jq -r '.[].version' 2>/dev/null || echo "")

  if [[ -n "$APPLIED" ]]; then
    PENDING_LIST=()
    for file in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
      version=$(basename "$file" | cut -d_ -f1)
      if ! echo "$APPLIED" | grep -qx "$version"; then
        PENDING_LIST+=("$(basename "$file")")
      fi
    done

    if [[ ${#PENDING_LIST[@]} -gt 0 ]]; then
      ISSUES+=("Migrations not pushed to remote: ${PENDING_LIST[*]}. Run: make supabase-push")
    fi
  fi
else
  # No credentials — warn only if migrations changed in the last commit
  RECENT=$(git diff --name-only HEAD 2>/dev/null | grep "^supabase/migrations/" || true)
  RECENT+=$(git diff --cached --name-only 2>/dev/null | grep "^supabase/migrations/" || true)
  if [[ -n "$RECENT" ]]; then
    ISSUES+=("New migrations detected. Run: make supabase-push (requires Doppler auth)")
  fi
fi

# ── 2. TypeScript check if .ts/.tsx files were modified ──────────────────────
CHANGED_TS=$(git diff --name-only HEAD 2>/dev/null | grep -E '\.(ts|tsx)$' || true)
CHANGED_TS+=$(git diff --cached --name-only 2>/dev/null | grep -E '\.(ts|tsx)$' || true)
if [[ -n "$CHANGED_TS" ]]; then
  cd "$REPO_ROOT"
  if ! npm run typecheck --silent 2>/dev/null; then
    ISSUES+=("TypeScript errors detected. Run: make typecheck")
  fi
fi

# ── Report ────────────────────────────────────────────────────────────────────
if [[ ${#ISSUES[@]} -gt 0 ]]; then
  MSG="Verification failed — fix before ending session:"$'\n'
  for issue in "${ISSUES[@]}"; do
    MSG+="  • $issue"$'\n'
  done
  echo "$MSG" >&2
  exit 2
fi

exit 0
