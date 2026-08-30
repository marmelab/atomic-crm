#!/usr/bin/env bash
# Apply schema + W0–W3 seed. Prove two triangles, paired agents, saved views, isolation.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose)
PSQL=(docker compose exec -T postgres psql -U ardley -d ardley_crm -v ON_ERROR_STOP=1)

echo "Starting Postgres…"
"${COMPOSE[@]}" up -d postgres
for _ in $(seq 1 30); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U ardley -d ardley_crm >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
"${COMPOSE[@]}" exec -T postgres pg_isready -U ardley -d ardley_crm

echo "Resetting public schema…"
"${PSQL[@]}" -c "drop schema if exists public cascade; create schema public; grant all on schema public to ardley; grant all on schema public to public;"

echo "Applying docs/schema-direction.sql…"
"${PSQL[@]}" -f - < docs/schema-direction.sql

echo "Seeding W0 + W1 + W3 + roster…"
"${PSQL[@]}" -f - < sql/seed_w0.sql
"${PSQL[@]}" -f - < sql/seed_w1.sql
"${PSQL[@]}" -f - < sql/seed_w3.sql
"${PSQL[@]}" -f - < sql/seed_w3_roster.sql

WOODLEY="$(
  "${PSQL[@]}" -Atc "select id from tenants where ardley_customer_id = '100004'"
)"
ENVOY="$(
  "${PSQL[@]}" -Atc "select id from tenants where ardley_customer_id = '100081'"
)"

APP_PSQL=(docker compose exec -T -e PGPASSWORD=crm_app postgres psql -U crm_app -d ardley_crm -v ON_ERROR_STOP=1)
last() { printf '%s\n' "$1" | tail -n 1; }

borrowers="$(
  last "$(
    "${APP_PSQL[@]}" -Atc "select set_config('app.tenant_id', '$WOODLEY', false);
      select count(*) from contact_type_assignments where type_id = 'borrower'"
  )"
)"
paired="$(
  last "$(
    "${APP_PSQL[@]}" -Atc "select set_config('app.tenant_id', '$WOODLEY', false);
      select count(*) from list_members
      where list_id = 'a1000004-0004-4000-8000-000000000001'"
  )"
)"
in_process="$(
  last "$(
    "${APP_PSQL[@]}" -Atc "select set_config('app.tenant_id', '$WOODLEY', false);
      select count(*) from deals
      where pipeline_id = 'c1000001-0001-4000-8000-000000000004'"
  )"
)"
views="$(
  last "$(
    "${APP_PSQL[@]}" -Atc "select set_config('app.tenant_id', '$WOODLEY', false);
      select count(*) from saved_views"
  )"
)"

contacts="$(
  last "$(
    "${APP_PSQL[@]}" -Atc "select set_config('app.tenant_id', '$WOODLEY', false);
      select count(*) from contacts where merged_into_id is null"
  )"
)"
agents="$(
  last "$(
    "${APP_PSQL[@]}" -Atc "select set_config('app.tenant_id', '$WOODLEY', false);
      select count(*) from contact_type_assignments where type_id = 'real_estate_agent'"
  )"
)"
dups="$(
  last "$(
    "${APP_PSQL[@]}" -Atc "select set_config('app.tenant_id', '$WOODLEY', false);
      select count(*) from contacts where first_name = 'Willow' and last_name = 'Woodley'"
  )"
)"

echo "Woodley borrowers=$borrowers paired_list=$paired in_process=$in_process views=$views contacts=$contacts agents=$agents willow_rows=$dups"

if [[ "$borrowers" -lt 70 || "$paired" -lt 8 || "$in_process" -lt 20 || "$views" != 4 || "$contacts" -lt 80 || "$agents" -lt 35 || "$dups" -lt 2 ]]; then
  echo "W3 seed smoke failed." >&2
  exit 1
fi

woodley_envoy_deal="$(
  last "$(
    "${APP_PSQL[@]}" -Atc "select set_config('app.tenant_id', '$WOODLEY', false);
      select count(*) from deals where name = 'Ellis isolation loan'"
  )"
)"
envoy_blair="$(
  last "$(
    "${APP_PSQL[@]}" -Atc "select set_config('app.tenant_id', '$ENVOY', false);
      select count(*) from contacts where last_name = 'Borrower'"
  )"
)"

if [[ "$woodley_envoy_deal" != 0 || "$envoy_blair" != 0 ]]; then
  echo "W3 isolation failed: woodley_sees_envoy_deal=$woodley_envoy_deal envoy_sees_blair=$envoy_blair" >&2
  exit 1
fi

echo "W3 smoke passed: roster, views, isolation."
