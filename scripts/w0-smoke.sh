#!/usr/bin/env bash
# Apply directional schema to local Docker Postgres and prove Woodley cannot see Envoy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose)
PSQL=(docker compose exec -T postgres psql -U ardley -d ardley_crm -v ON_ERROR_STOP=1)

python3 "$ROOT/scripts/tenant_uuid.py"

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

echo "Seeding W0…"
"${PSQL[@]}" -f - < sql/seed_w0.sql

WOODLEY="$(
  "${PSQL[@]}" -Atc "select id from tenants where ardley_customer_id = '100004'"
)"
ENVOY="$(
  "${PSQL[@]}" -Atc "select id from tenants where ardley_customer_id = '100081'"
)"

if [[ -z "$WOODLEY" || -z "$ENVOY" || "$WOODLEY" == "$ENVOY" ]]; then
  echo "Expected two distinct tenant UUIDs, got woodley='$WOODLEY' envoy='$ENVOY'" >&2
  exit 1
fi

echo "Woodley tenant $WOODLEY"
echo "Envoy   tenant $ENVOY"

APP_PSQL=(docker compose exec -T -e PGPASSWORD=crm_app postgres psql -U crm_app -d ardley_crm -v ON_ERROR_STOP=1)

woodley_sees_woodley="$(
  "${APP_PSQL[@]}" -Atc "select set_config('app.tenant_id', '$WOODLEY', false); select count(*) from contacts where last_name = 'Woodley'"
)"
woodley_sees_envoy="$(
  "${APP_PSQL[@]}" -Atc "select set_config('app.tenant_id', '$WOODLEY', false); select count(*) from contacts where last_name = 'Envoy'"
)"
envoy_sees_envoy="$(
  "${APP_PSQL[@]}" -Atc "select set_config('app.tenant_id', '$ENVOY', false); select count(*) from contacts where last_name = 'Envoy'"
)"
envoy_sees_woodley="$(
  "${APP_PSQL[@]}" -Atc "select set_config('app.tenant_id', '$ENVOY', false); select count(*) from contacts where last_name = 'Woodley'"
)"

# set_config output is prepended; take the last line
last() { printf '%s\n' "$1" | tail -n 1; }

w_w="$(last "$woodley_sees_woodley")"
w_e="$(last "$woodley_sees_envoy")"
e_e="$(last "$envoy_sees_envoy")"
e_w="$(last "$envoy_sees_woodley")"

echo "As Woodley: Woodley contacts=$w_w Envoy contacts=$w_e"
echo "As Envoy:   Envoy contacts=$e_e Woodley contacts=$e_w"

if [[ "$w_w" != 1 || "$e_e" != 1 || "$w_e" != 0 || "$e_w" != 0 ]]; then
  echo "Isolation smoke failed." >&2
  exit 1
fi

echo "W0 smoke passed: Woodley 100004 cannot see Envoy 100081."
