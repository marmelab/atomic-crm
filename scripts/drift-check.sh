#!/usr/bin/env bash
#
# Supabase security drift check.
#
# Runs scripts/drift-check.sql against a remote Supabase project via psql and
# exits non-zero if any drift finding is returned. Intended for use in CI
# (see .github/workflows/security-drift.yml) and for ad-hoc runs from a
# developer machine.
#
# Required environment:
#   SUPABASE_DB_URL  postgres:// connection string (use the pooler URL from
#                    Supabase Studio > Project Settings > Database > Connection string)
#
# Optional environment:
#   SUPABASE_LABEL   human-readable label printed with every finding (useful
#                    when the workflow runs across multiple projects)
#
# Exit codes:
#   0  no drift
#   1  drift detected
#   2  configuration error (missing env / psql not installed)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/drift-check.sql"
LABEL="${SUPABASE_LABEL:-supabase}"

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "error: SUPABASE_DB_URL is not set" >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "error: psql is not installed (install postgresql-client)" >&2
  exit 2
fi

if [[ ! -f "$SQL_FILE" ]]; then
  echo "error: SQL file not found: $SQL_FILE" >&2
  exit 2
fi

# -t   tuples only (no headers, no footer)
# -A   unaligned output (no padding)
# -F $'\t'  tab-separated fields
# ON_ERROR_STOP=1  fail fast on SQL errors
output=$(
  PGOPTIONS="-c statement_timeout=30000" \
    psql "$SUPABASE_DB_URL" \
    --no-psqlrc \
    -v ON_ERROR_STOP=1 \
    -t -A -F $'\t' \
    -f "$SQL_FILE"
)

if [[ -z "$output" ]]; then
  echo "[${LABEL}] OK: no security drift detected."
  exit 0
fi

echo "[${LABEL}] ✗ security drift detected:" >&2
echo >&2
printf "%-25s  %-60s  %s\n" "FINDING" "OBJECT" "REMEDIATION" >&2
printf "%-25s  %-60s  %s\n" "-------" "------" "-----------" >&2
while IFS=$'\t' read -r finding object remediation; do
  printf "%-25s  %-60s  %s\n" "$finding" "$object" "$remediation" >&2
done <<< "$output"
echo >&2
echo "[${LABEL}] run scripts/drift-check.sql against the project for full context" >&2
exit 1
