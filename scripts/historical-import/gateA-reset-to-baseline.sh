#!/usr/bin/env bash
# Gate A: return the disposable project to the verified MAIN-derived
# baseline so a pass-1 run always starts from the same known state.
# Deletes every business row, re-loads the baseline (which re-aligns the
# identity sequences), strips the events the unguarded
# record_deal_stage_event() trigger manufactures while re-inserting the
# baseline Deals, then proves the result matches MAIN row-for-row.
set -euo pipefail

# DESTRUCTIVE: deletes every business row. Disposable proof environments
# only — the target must be passed explicitly and can never be MAIN.
MAIN_REF="xlyywsguftyvomeretju"
REF="${SUPABASE_TARGET_REF:?SUPABASE_TARGET_REF must be set to a DISPOSABLE project ref}"
if [ "$REF" = "$MAIN_REF" ]; then
  echo "REFUSING: this script deletes all business rows and must never target MAIN ($MAIN_REF)." >&2
  exit 1
fi
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
Q() { npx supabase db query --linked --project-ref "$REF" >/dev/null 2>&1; }

# MAIN's own deal_stage_events ids — anything else in the table after a
# baseline reload was manufactured by the trigger, not restored from MAIN.
BASELINE_DSE_IDS="23,24,25,26,31,32"

echo "--- clearing business tables"
Q <<SQL
begin;
select set_historical_migration_mode(true);
delete from historical_import_records;
delete from deal_stage_events;
delete from enrollment_status_events;
delete from enrollment_onboarding_items;
delete from client_sessions;
delete from sales_calls;
delete from applications;
delete from waitlist_entries;
delete from enrollments;
delete from tasks;
delete from deals;
delete from contacts;
select set_historical_migration_mode(false);
commit;
SQL

echo "--- reloading MAIN-derived baseline"
Q < "$HERE/data/baseline_load.sql"

echo "--- removing trigger-manufactured deal_stage_events"
Q <<SQL
begin;
select set_historical_migration_mode(true);
delete from deal_stage_events where id not in ($BASELINE_DSE_IDS);
select setval(pg_get_serial_sequence('deal_stage_events','id'), coalesce((select max(id) from deal_stage_events),0) + 1, false);
select set_historical_migration_mode(false);
commit;
SQL

echo "--- verifying baseline fidelity against MAIN"
node "$HERE/gateA-verify-baseline.mjs" emit >/dev/null
npx supabase db query --linked --project-ref "$REF" \
  < "$HERE/data/baseline_compare.sql" 2>/dev/null > /tmp/baseline_actual.json
node "$HERE/gateA-verify-baseline.mjs" compare /tmp/baseline_actual.json | grep -E '"totalMismatches"'
