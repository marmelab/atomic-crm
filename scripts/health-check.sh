#!/usr/bin/env bash
#
# health-check.sh - Verify Hatch CRM Supabase project is responsive
#
# Usage:
#   ./scripts/health-check.sh          # Check anon-safe endpoints
#   ./scripts/health-check.sh --quiet  # Exit code only (for cron/monitoring)
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
QUIET="${1:-}"
FAILURES=0

get_env_value() {
    local key="$1"

    if [[ -n "${!key:-}" ]]; then
        printf '%s' "${!key}"
        return 0
    fi

    if [[ -f "$ENV_FILE" ]]; then
        local value
        value="$(grep -m1 "^${key}=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '\r' || true)"
        value="${value%\"}"
        value="${value#\"}"
        value="${value%\'}"
        value="${value#\'}"

        if [[ -n "$value" ]]; then
            printf '%s' "$value"
            return 0
        fi
    fi

    return 1
}

SUPABASE_URL="$(get_env_value VITE_SUPABASE_URL || true)"
PUBLISHABLE_KEY="$(get_env_value VITE_SB_PUBLISHABLE_KEY || true)"

if [[ -z "$SUPABASE_URL" || -z "$PUBLISHABLE_KEY" ]]; then
    echo "Error: VITE_SUPABASE_URL and VITE_SB_PUBLISHABLE_KEY must be set in the environment or .env."
    exit 1
fi

check() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    local status

    status="$(curl -s -o /dev/null -w "%{http_code}" \
        -H "apikey: ${PUBLISHABLE_KEY}" \
        -H "Authorization: Bearer ${PUBLISHABLE_KEY}" \
        --max-time 10 \
        "$url" 2>/dev/null || echo "000")"

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
[[ "$QUIET" != "--quiet" ]] && echo "Note: RLS-protected tables require an authenticated user JWT, so this script only checks anon-safe endpoints."
[[ "$QUIET" != "--quiet" ]] && echo "Note: ingest-lead is POST-only; a GET returning 405 confirms the route exists."
[[ "$QUIET" != "--quiet" ]] && echo ""

check "Supabase REST API" "${SUPABASE_URL}/rest/v1/" "200"
check "Supabase Auth" "${SUPABASE_URL}/auth/v1/settings" "200"
check "Storage API" "${SUPABASE_URL}/storage/v1/bucket" "200"
check "Lead ingestion function" "${SUPABASE_URL}/functions/v1/ingest-lead" "405"

[[ "$QUIET" != "--quiet" ]] && echo ""

if [[ $FAILURES -eq 0 ]]; then
    [[ "$QUIET" != "--quiet" ]] && echo "All checks passed."
    exit 0
else
    [[ "$QUIET" != "--quiet" ]] && echo "${FAILURES} check(s) failed."
    exit 1
fi
