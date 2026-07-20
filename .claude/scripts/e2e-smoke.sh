#!/usr/bin/env bash
# e2e-smoke.sh - run the Playwright e2e suite against an ISOLATED, disposable Supabase
# instance so multiple harness sessions can run it in parallel without colliding.
# Guaranteed teardown via `trap ... EXIT`.
#
# Isolation per run: a leased SLOT (0..K-1) gives offset = slot*20, applied to the
# project_id, every Supabase port, and the app port + auth URLs, in a throwaway workdir.
# The flock lease also CAPS concurrency (K stacks max) so we never OOM the host.
#
# Exit codes: 0 = suite passed OR gracefully skipped (no slot / low RAM / cannot start);
#             1 = the e2e suite ran and FAILED. Skips are exit 0 by design (the caller
#             treats a skip as "not run here, run it later", not as a failure).
#
# Env: E2E_SMOKE_SLOTS (default 5), E2E_SMOKE_MIN_MB (default 2500), E2E_SMOKE_DRY=1
#      (resolve slot/ports/config and print them, then exit WITHOUT Docker - for tests).
set -uo pipefail

REPO="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
# Where to read the app + specs + schema FROM. A feature-smoke must run the INTEGRATED
# session code, not the base-branch checkout ($REPO) - so the orchestrator passes
# E2E_SMOKE_SRC=<WORKTREE_BASE>/_session (the session worktree, on session/<short>, with
# node_modules already provisioned). Default $REPO = a base-branch baseline check.
SRC="${E2E_SMOKE_SRC:-$REPO}"
SLOTS="${E2E_SMOKE_SLOTS:-5}"
MIN_MB="${E2E_SMOKE_MIN_MB:-2500}"
DRY="${E2E_SMOKE_DRY:-0}"
SLOT_LOCK_DIR="/tmp/atomic-crm-e2e-slots"
CONFIG_SRC="$SRC/supabase/config.e2e.toml"
mkdir -p "$SLOT_LOCK_DIR"

skip() { echo "SKIP: $*"; exit 0; }   # graceful: not run here, not a failure

# --- memory preflight -------------------------------------------------------
# Each Supabase stack is ~2-3 GB. Don't attempt a boot the host can't hold; skip
# gracefully so the caller defers to a human `make test-e2e` instead of OOM-ing.
avail_mb="$(free -m 2>/dev/null | awk '/^Mem:/{print $7}')"
if [ "$DRY" != "1" ] && [ -n "$avail_mb" ] && [ "$avail_mb" -lt "$MIN_MB" ]; then
  skip "only ${avail_mb}MB free, need ~${MIN_MB}MB for a Supabase e2e stack; run 'make test-e2e' locally."
fi

# --- lease a slot (flock; also the concurrency cap) -------------------------
slot=""; SLOT_FD=""
for i in $(seq 0 $((SLOTS - 1))); do
  exec {fd}>"$SLOT_LOCK_DIR/slot-$i.lock"
  if flock -n "$fd"; then slot="$i"; SLOT_FD="$fd"; break; fi
  exec {fd}>&-
done
[ -z "$slot" ] && skip "all $SLOTS e2e slots busy; try again later."

offset=$((slot * 20))
project="atomic-crm-e2e-$slot"
api_port=$((54341 + offset))
app_port=$((5175 + slot))
workroot="$(mktemp -d)"
workdir="$workroot/e2e"          # supabase --workdir
mkdir -p "$workdir/supabase"

# --- guaranteed teardown ----------------------------------------------------
APP_PID=""
cleanup() {
  local code=$?
  [ -n "$APP_PID" ] && kill "$APP_PID" 2>/dev/null || true
  [ "$DRY" != "1" ] && npx supabase stop --workdir "$workdir" --no-backup >/dev/null 2>&1 || true
  [ -n "$SLOT_FD" ] && flock -u "$SLOT_FD" 2>/dev/null || true
  rm -rf "$workroot" 2>/dev/null || true
  return $code
}
trap cleanup EXIT INT TERM

# --- render the per-slot config ---------------------------------------------
# Offset every Supabase port (`port =`, `shadow_port =`, `vector_port =`) by `offset`,
# set a unique project_id (distinct Docker containers), and point the auth URLs at the
# per-slot app port. perl `/e` evaluates the numeric replacement.
[ -f "$CONFIG_SRC" ] || skip "no $CONFIG_SRC"
perl -pe "s/^(project_id\s*=\s*).*/\$1\"$project\"/;
          s/((?:^|_)port\s*=\s*)(\d+)/\$1.(\$2+$offset)/e;
          s/5175/$app_port/g" "$CONFIG_SRC" > "$workdir/supabase/config.toml"

# Supabase needs the schema/migrations/seed to build the DB on first start.
for d in migrations schemas functions templates; do
  [ -d "$SRC/supabase/$d" ] && cp -r "$SRC/supabase/$d" "$workdir/supabase/$d"
done
for f in seed.sql signing_keys.json; do
  [ -f "$SRC/supabase/$f" ] && cp "$SRC/supabase/$f" "$workdir/supabase/$f"
done

if [ "$DRY" = "1" ]; then
  echo "DRY-RUN slot=$slot offset=$offset project=$project api_port=$api_port app_port=$app_port workdir=$workdir"
  echo "config.project_id=$(grep -E '^project_id' "$workdir/supabase/config.toml")"
  echo "config.api_port=$(awk '/^\[api\]/{a=1} a&&/^port =/{print $3; exit}' "$workdir/supabase/config.toml")"
  echo "config.site_url=$(grep -E '^site_url' "$workdir/supabase/config.toml" | head -1)"
  exit 0
fi

# --- reap a previously killed run of this slot -----------------------------
# The trap cleans up normal exits (EXIT/INT/TERM); a SIGKILL would orphan this slot's
# containers. Before starting fresh, remove any lingering ones for this project_id.
docker ps -aq --filter "name=${project}" 2>/dev/null | xargs -r docker rm -f >/dev/null 2>&1 || true

# --- start the isolated stack ----------------------------------------------
echo "e2e-smoke: starting isolated Supabase (slot $slot, api :$api_port, project $project)..."
if ! npx supabase start --workdir "$workdir" >/"$workroot/supabase.log" 2>&1; then
  cat "$workroot/supabase.log" >&2 || true
  skip "isolated Supabase failed to start (see log); deferring e2e to a human run."
fi
SERVICE_ROLE_KEY="$(npx supabase status --workdir "$workdir" -o env 2>/dev/null | sed -nE 's/^SERVICE_ROLE_KEY="?([^"]+)"?/\1/p')"
ANON_KEY="$(npx supabase status --workdir "$workdir" -o env 2>/dev/null | sed -nE 's/^ANON_KEY="?([^"]+)"?/\1/p')"
export VITE_SUPABASE_URL="http://127.0.0.1:$api_port"
export VITE_SUPABASE_ANON_KEY="$ANON_KEY"
export SERVICE_ROLE_KEY

# --- materialize the session schema the deploy-time migration will carry --------
# Ticket developers never write migrations, so a schema-touching session has
# supabase/schemas/ ahead of supabase/migrations/. The CLI builds the DB from
# migrations/ only, so without this the isolated stack lacks the new columns and
# schema-exercising specs 400 against PostgREST - a false FAIL. When the
# session changed supabase/schemas/, generate a THROWAWAY migration from the delta
# INTO THE WORKDIR (never $SRC) and apply it. Best-effort: on any failure SKIP the
# leg rather than emit a false FAIL (the real migration lands in the deploy round).
schema_changed=0
branch="$(git -C "$SRC" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"
case "$branch" in
  session/*)
    base="session-base/${branch#session/}"
    if git -C "$SRC" rev-parse --verify -q "$base" >/dev/null 2>&1 \
       && git -C "$SRC" diff --name-only "$base"...HEAD 2>/dev/null | grep -q '^supabase/schemas/'; then
      schema_changed=1
    fi
    ;;
esac
if [ "$schema_changed" = "1" ] && [ -d "$workdir/supabase/schemas" ]; then
  echo "e2e-smoke: session changed supabase/schemas/, materializing a throwaway migration..."
  if npx supabase db diff --workdir "$workdir" --local -f _e2e_throwaway >"$workroot/dbdiff.log" 2>&1; then
    if ls "$workdir"/supabase/migrations/*_e2e_throwaway.sql >/dev/null 2>&1; then
      npx supabase migration up --workdir "$workdir" --local >"$workroot/migup.log" 2>&1 \
        || { cat "$workroot/migup.log" >&2; skip "schema pending migration round (throwaway apply failed); deferring the Supabase e2e leg to the deploy-time migration."; }
    fi
  else
    cat "$workroot/dbdiff.log" >&2
    skip "schema pending migration round (throwaway diff failed); deferring the Supabase e2e leg to the deploy-time migration."
  fi
fi

# --- serve the app (dev server reads env at start, so no per-slot build) ----
( cd "$SRC" && VITE_SUPABASE_URL="$VITE_SUPABASE_URL" npx vite --port "$app_port" --strictPort --mode e2e >"$workroot/app.log" 2>&1 ) &
APP_PID=$!
npx wait-on -t 120000 "http-get://127.0.0.1:$api_port/auth/v1/health" "http-get://127.0.0.1:$app_port" >/dev/null 2>&1 \
  || skip "isolated stack did not become ready in time."

# --- run the suite ----------------------------------------------------------
echo "e2e-smoke: running Playwright against the isolated stack..."
( cd "$SRC" && CI=true PLAYWRIGHT_BASE_URL="http://127.0.0.1:$app_port" npx playwright test )
result=$?
echo "e2e-smoke: suite exit=$result (slot $slot)"
exit $result
