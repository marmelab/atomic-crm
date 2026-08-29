#!/usr/bin/env bash
# BFF show payloads stay on the stub principal.
set -euo pipefail
BFF_URL="${CRM_BFF_URL:-http://127.0.0.1:8787}"
WILLOW="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
DEAL="d1000003-0003-4000-8000-000000000001"
TEAM="c1000002-0002-4000-8000-000000000002"

get() {
  curl -sf -H "x-ardley-customer-id: $1" "$2"
}

willow="$(get 100004 "${BFF_URL}/contacts/${WILLOW}")"
envoy_willow="$(curl -s -o /tmp/envoy-willow.json -w '%{http_code}' -H 'x-ardley-customer-id: 100081' "${BFF_URL}/contacts/${WILLOW}")"
deal="$(get 100004 "${BFF_URL}/deals/${DEAL}")"
team="$(get 100004 "${BFF_URL}/companies/${TEAM}")"

python3 - "$willow" "$envoy_willow" "$deal" "$team" <<'PY'
import json, sys
willow = json.loads(sys.argv[1])
envoy_status = sys.argv[2]
deal = json.loads(sys.argv[3])
team = json.loads(sys.argv[4])
data = willow["data"]
if data["first_name"] != "Willow":
    raise SystemExit(data)
roles = {p["role"] for p in data["deals"]}
if roles != {"borrower"}:
    raise SystemExit(f"expected borrower deal, got {roles}")
if not any(l["link_type_id"] == "spouse" for l in data["links"]):
    raise SystemExit("missing spouse link")
if envoy_status != "404":
    raise SystemExit(f"Envoy could read Willow: {envoy_status}")
if deal["data"]["name"] != "Willow purchase":
    raise SystemExit(deal)
if len(deal["data"]["parties"]) != 4:
    raise SystemExit(deal["data"]["parties"])
if team["data"]["name"] != "Agents with a Grin":
    raise SystemExit(team)
if not team["data"]["parent"]:
    raise SystemExit("team missing parent")
print("W2 isolation passed: show graph stays on Woodley.")
PY
