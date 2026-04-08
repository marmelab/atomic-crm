#!/usr/bin/env bash
#
# health-check.sh — Verify Hatch CRM Supabase project is responsive
#
# Usage:
#   ./scripts/health-check.sh          # Check all endpoints
#   ./scripts/health-check.sh --quiet  # Exit code only (for cron/monitoring)
#
# Exit codes:
#   0 — All checks passed
#   1 — One or more checks failed

set -euo pipefail

SUPABASE_URL="https://sstvgrbzecdhysdgoall.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdHZncmJ6ZWNkaHlzZGdvYWxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTU0NTMsImV4cCI6MjA5MTIzMTQ1M30.ng_3oomkreEDa-gSbq8JxxVbdnIU5p6oH6S98LfNasI"
QUIET="${1:-}"
FAILURES=0

check() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"

    status=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "apikey: ${ANON_KEY}" \
        -H "Authorization: Bearer ${ANON_KEY}" \
        --max-time 10 \
        "$url" 2>/dev/null || echo "000")

    if [[ "$status" == "$expected_status" ]]; then
        [[ "$QUIET" != "--quiet" ]] && echo "[PASS] ${name} (HTTP ${status})"
    else
        [[ "$QUIET" != "--quiet" ]] && echo "[FAIL] ${name} (HTTP ${status}, expected ${expected_status})"
        FAILURES=$((FAILURES + 1))
    fi
}

[[ "$QUIET" != "--quiet" ]] && echo "Hatch CRM Health Check"
[[ "$QUIET" != "--quiet" ]] && echo "======================"
[[ "$QUIET" != "--quiet" ]] && echo ""

# 1. Supabase REST API is reachable
check "Supabase REST API" "${SUPABASE_URL}/rest/v1/" "200"

# 2. Auth endpoint responds
check "Supabase Auth" "${SUPABASE_URL}/auth/v1/settings" "200"

# 3. Can query companies table (RLS will filter, but endpoint responds)
check "Companies table" "${SUPABASE_URL}/rest/v1/companies?select=id&limit=1" "200"

# 4. Can query integration_log table
check "Integration log table" "${SUPABASE_URL}/rest/v1/integration_log?select=id&limit=1" "200"

# 5. Storage API responds
check "Storage API" "${SUPABASE_URL}/storage/v1/bucket" "200"

# 6. Edge Functions endpoint (lead ingestion)
check "Lead ingestion function" "${SUPABASE_URL}/functions/v1/ingest-lead" "401"

[[ "$QUIET" != "--quiet" ]] && echo ""

if [[ $FAILURES -eq 0 ]]; then
    [[ "$QUIET" != "--quiet" ]] && echo "All checks passed."
    exit 0
else
    [[ "$QUIET" != "--quiet" ]] && echo "${FAILURES} check(s) failed."
    exit 1
fi
