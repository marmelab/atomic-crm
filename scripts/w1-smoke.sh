#!/usr/bin/env bash
# Apply schema + W0/W1 seed. Prove triangle, no cascade-delete of people, tenant isolation.
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

echo "Seeding W0 + W1…"
"${PSQL[@]}" -f - < sql/seed_w0.sql
"${PSQL[@]}" -f - < sql/seed_w1.sql

WOODLEY="$(
  "${PSQL[@]}" -Atc "select id from tenants where ardley_customer_id = '100004'"
)"
ENVOY="$(
  "${PSQL[@]}" -Atc "select id from tenants where ardley_customer_id = '100081'"
)"

APP_PSQL=(docker compose exec -T -e PGPASSWORD=crm_app postgres psql -U crm_app -d ardley_crm -v ON_ERROR_STOP=1)
last() { printf '%s\n' "$1" | tail -n 1; }

parties="$(
  last "$(
    "${APP_PSQL[@]}" -Atc "select set_config('app.tenant_id', '$WOODLEY', false);
      select count(*) from deal_parties
      where deal_id = 'd1000003-0003-4000-8000-000000000001'"
  )"
)"
tree_depth="$(
  last "$(
    "${APP_PSQL[@]}" -Atc "select set_config('app.tenant_id', '$WOODLEY', false);
      select max(depth) from company_tree"
  )"
)"
nmls="$(
  last "$(
    "${APP_PSQL[@]}" -Atc "select set_config('app.tenant_id', '$WOODLEY', false);
      select count(*) from contact_identifiers
      where id_type = 'nmls' and value = '999001'"
  )"
)"

echo "Woodley deal parties=$parties company_tree max depth=$tree_depth nmls=$nmls"

if [[ "$parties" != 4 || "$tree_depth" != 1 || "$nmls" != 1 ]]; then
  echo "W1 triangle smoke failed." >&2
  exit 1
fi

# Deleting a company must not wipe people (RESTRICT on affiliations).
set +e
delete_out="$(
  "${PSQL[@]}" -c "delete from companies where id = 'c1000002-0002-4000-8000-000000000002'" 2>&1
)"
delete_rc=$?
set -e
if [[ "$delete_rc" -eq 0 ]]; then
  echo "Expected company delete to fail while affiliations exist:" >&2
  echo "$delete_out" >&2
  exit 1
fi
agent_count="$(
  "${PSQL[@]}" -Atc "select count(*) from contacts where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac'"
)"
if [[ "$agent_count" != 1 ]]; then
  echo "Agent contact missing after blocked company delete." >&2
  exit 1
fi

woodley_envoy_deals="$(
  last "$(
    "${APP_PSQL[@]}" -Atc "select set_config('app.tenant_id', '$WOODLEY', false);
      select count(*) from companies where name = 'Envoy Isolation Branch'"
  )"
)"
envoy_woodley_deals="$(
  last "$(
    "${APP_PSQL[@]}" -Atc "select set_config('app.tenant_id', '$ENVOY', false);
      select count(*) from deals where name = 'Willow purchase'"
  )"
)"

if [[ "$woodley_envoy_deals" != 0 || "$envoy_woodley_deals" != 0 ]]; then
  echo "W1 isolation failed: woodley_sees_envoy_co=$woodley_envoy_deals envoy_sees_woodley_deal=$envoy_woodley_deals" >&2
  exit 1
fi

echo "W1 smoke passed: triangle, restrict-delete, Woodley cannot see Envoy graph."
