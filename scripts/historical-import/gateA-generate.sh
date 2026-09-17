#!/usr/bin/env bash
# Gate A: re-read the target's live sequence state AND row state, then
# generate the import SQL from THAT reading — in one step, so the two can
# never drift. Identity sequences advance through rolled-back
# transactions, so a value read before an earlier failed attempt is stale
# and produces foreign keys to rows that will never exist. Regenerating
# without re-reading was a real failure in this proof; fusing the two is
# what stops it recurring.
#
# Usage: SUPABASE_TARGET_REF=<project-ref> gateA-generate.sh <outSql> [priorStateFile]
set -euo pipefail

# Target project ref is REQUIRED and explicit — this script must run against
# MAIN at real import time and against a disposable project during proofs,
# and silently defaulting to either one is how the wrong database gets read.
REF="${SUPABASE_TARGET_REF:?SUPABASE_TARGET_REF must be set to the target project ref}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_SQL="$1"
PRIOR_STATE="${2:-}"
WORK="$(dirname "$OUT_SQL")"

npx supabase db query --linked --project-ref "$REF" \
  < "$HERE/gateA-prepare.sql" 2>/dev/null > "$WORK/gateA_prep_raw.json"

node -e '
const fs = require("fs");
const [rawPath, idsPath, statePath] = process.argv.slice(1);
const prep = JSON.parse(JSON.parse(fs.readFileSync(rawPath, "utf8")).rows[0].prep);
fs.writeFileSync(idsPath, JSON.stringify(prep.nextIds, null, 2));
fs.writeFileSync(statePath, JSON.stringify(prep.state));
console.error("live nextIds: " + JSON.stringify(prep.nextIds));
' "$WORK/gateA_prep_raw.json" "$WORK/gateA_next_ids.json" "$WORK/gateA_target_state.json"

node "$HERE/gateA-full-import.mjs" \
  "$OUT_SQL" "$WORK/gateA_next_ids.json" "$WORK/gateA_target_state.json" ${PRIOR_STATE:+"$PRIOR_STATE"}
