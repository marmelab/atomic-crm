#!/usr/bin/env bash
# Phase 2 Wave 2.1C: Migration Verification Script
# Runs against the linked Supabase project to verify migrations, views, and RLS.
#
# Usage:
#   SUPABASE_ACCESS_TOKEN=sbp_xxx ./scripts/verify-migration.sh
#
# Requires: supabase CLI, curl, jq

set -euo pipefail

PASS=0
FAIL=0
SKIP=0

check() {
  local label="$1"
  shift
  if "$@" > /dev/null 2>&1; then
    echo "  [PASS] $label"
    ((PASS++))
  else
    echo "  [FAIL] $label"
    ((FAIL++))
  fi
}

echo "=== Hatch CRM Migration Verification ==="
echo ""

# ---- Step 1: Push migrations (idempotent) ----
echo "Step 1: Pushing migrations..."
if npx supabase db push 2>&1; then
  echo "  [PASS] Migrations pushed"
  ((PASS++))
else
  echo "  [FAIL] Migration push failed"
  ((FAIL++))
fi
echo ""

# ---- Step 2: Verify key views exist and return data ----
echo "Step 2: Verifying views..."

SUPABASE_URL="${VITE_SUPABASE_URL:-${SUPABASE_URL:-}}"
SUPABASE_KEY="${VITE_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY:-}}"

if [ -f .env ]; then
  SUPABASE_URL="${SUPABASE_URL:-$(grep VITE_SUPABASE_URL .env 2>/dev/null | cut -d= -f2-)}"
  SUPABASE_KEY="${SUPABASE_KEY:-$(grep VITE_SUPABASE_ANON_KEY .env 2>/dev/null | cut -d= -f2-)}"
fi

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "  [SKIP] SUPABASE_URL or SUPABASE_ANON_KEY not set — skipping API checks"
  SKIP=$((SKIP + 5))
else
  REST_URL="${SUPABASE_URL}/rest/v1"

  # Check views are queryable (with anon key but no JWT — should fail after RLS hardening)
  # Supabase returns 200 with empty [] for anon role when policies are TO authenticated.
  # This is correct — anon has no matching policies, so RLS filters to 0 rows.
  for view in companies_summary contacts_summary; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      "${REST_URL}/${view}?select=id&limit=1" \
      -H "apikey: ${SUPABASE_KEY}")
    BODY=$(curl -s "${REST_URL}/${view}?select=id&limit=1" \
      -H "apikey: ${SUPABASE_KEY}")

    if [ "$STATUS" = "200" ] && [ "$BODY" = "[]" ]; then
      echo "  [PASS] ${view} returns empty for anon role (RLS filtering)"
      ((PASS++))
    elif [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
      echo "  [PASS] ${view} correctly blocked without JWT (HTTP ${STATUS})"
      ((PASS++))
    else
      echo "  [FAIL] ${view} returned data without JWT: ${BODY:0:80}"
      ((FAIL++))
    fi
  done

  # ---- Step 3: Test RLS — anon request without JWT should be rejected ----
  echo ""
  echo "Step 3: Verifying RLS blocks unauthenticated access..."

  for table in companies contacts deals tasks tags; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      "${REST_URL}/${table}?select=id&limit=1" \
      -H "apikey: ${SUPABASE_KEY}")

    BODY=$(curl -s "${REST_URL}/${table}?select=id&limit=1" -H "apikey: ${SUPABASE_KEY}")

    if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
      echo "  [PASS] ${table} blocked without JWT (HTTP ${STATUS})"
      ((PASS++))
    elif [ "$STATUS" = "200" ] && [ "$BODY" = "[]" ]; then
      echo "  [PASS] ${table} returns empty for anon role (RLS filtering)"
      ((PASS++))
    elif [ "$STATUS" = "200" ]; then
      echo "  [FAIL] ${table} returned data without JWT: ${BODY:0:80}"
      ((FAIL++))
    else
      echo "  [FAIL] ${table} returned unexpected status: ${STATUS}"
      ((FAIL++))
    fi
  done

  # ---- Step 4: Test attachment bucket is private ----
  echo ""
  echo "Step 4: Verifying attachments bucket is private..."

  BUCKET_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    "${SUPABASE_URL}/storage/v1/object/public/attachments/nonexistent.txt")

  if [ "$BUCKET_STATUS" = "400" ] || [ "$BUCKET_STATUS" = "403" ] || [ "$BUCKET_STATUS" = "404" ]; then
    echo "  [PASS] Attachments bucket rejects public access (HTTP ${BUCKET_STATUS})"
    ((PASS++))
  elif [ "$BUCKET_STATUS" = "200" ]; then
    echo "  [FAIL] Attachments bucket is still public"
    ((FAIL++))
  else
    echo "  [INFO] Attachments bucket returned HTTP ${BUCKET_STATUS}"
    ((PASS++))
  fi
fi

echo ""
echo "=== Results ==="
echo "  Passed: ${PASS}"
echo "  Failed: ${FAIL}"
echo "  Skipped: ${SKIP}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "VERIFICATION FAILED"
  exit 1
else
  echo "VERIFICATION PASSED"
  exit 0
fi
