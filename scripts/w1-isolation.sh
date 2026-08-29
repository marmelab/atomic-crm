#!/usr/bin/env bash
# BFF: Woodley never sees Envoy company; Envoy never sees Woodley deal / NMLS.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BFF_URL="${CRM_BFF_URL:-http://127.0.0.1:8787}"

get() {
  local customer="$1"
  local path="$2"
  curl -sf -H "x-ardley-customer-id: ${customer}" "${BFF_URL}${path}"
}

woodley_contacts="$(get 100004 /contacts)"
woodley_companies="$(get 100004 /companies)"
woodley_deals="$(get 100004 /deals)"
envoy_companies="$(get 100081 /companies)"
envoy_deals="$(get 100081 /deals)"
woodley_nmls="$(get 100004 "/identifiers?type=nmls&value=999001")"
envoy_nmls="$(get 100081 "/identifiers?type=nmls&value=999001")"

python3 - "$woodley_contacts" "$woodley_companies" "$woodley_deals" "$envoy_companies" "$envoy_deals" "$woodley_nmls" "$envoy_nmls" <<'PY'
import json, sys

def load(i):
    return json.loads(sys.argv[i])

contacts, companies, deals, e_cos, e_deals, w_nmls, e_nmls = (load(i) for i in range(1, 8))
names = {f"{r['first_name']} {r['last_name']}" for r in contacts["data"]}
co_names = {r["name"] for r in companies["data"]}
deal_names = {r["name"] for r in deals["data"]}
e_co_names = {r["name"] for r in e_cos["data"]}
e_deal_names = {r["name"] for r in e_deals["data"]}

need = {"Willow Woodley", "Sam Spouse", "Avery Agent", "Phil Officer"}
if not need.issubset(names):
    raise SystemExit(f"Woodley missing triangle contacts: {names}")
if "Ellis Envoy" in names:
    raise SystemExit(f"Woodley saw Envoy contact: {names}")
if "Envoy Isolation Branch" in co_names:
    raise SystemExit(f"Woodley saw Envoy company: {co_names}")
if "Agents with a Grin" not in co_names:
    raise SystemExit(f"Woodley missing team: {co_names}")
if "Willow purchase" not in deal_names:
    raise SystemExit(f"Woodley missing deal: {deal_names}")
if "Willow purchase" in e_deal_names:
    raise SystemExit(f"Envoy saw Woodley deal: {e_deal_names}")
if "Agents with a Grin" in e_co_names:
    raise SystemExit(f"Envoy saw Woodley team: {e_co_names}")
if w_nmls["total"] != 1:
    raise SystemExit(f"Woodley NMLS 999001 missing: {w_nmls}")
if e_nmls["total"] != 0:
    raise SystemExit(f"Envoy saw Woodley NMLS: {e_nmls}")
print("W1 isolation passed: graph lists stay on the stub principal.")
PY
