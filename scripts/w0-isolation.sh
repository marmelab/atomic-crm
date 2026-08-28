#!/usr/bin/env bash
# Prove the local BFF never returns Ellis Envoy to a Woodley principal.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BFF_URL="${CRM_BFF_URL:-http://127.0.0.1:8787}"

json_contacts() {
  local customer="$1"
  curl -sf -H "x-ardley-customer-id: ${customer}" "${BFF_URL}/contacts"
}

woodley="$(json_contacts 100004)"
envoy="$(json_contacts 100081)"

python3 - "$woodley" "$envoy" <<'PY'
import json, sys
woodley = json.loads(sys.argv[1])
envoy = json.loads(sys.argv[2])
w_names = {f"{r['first_name']} {r['last_name']}" for r in woodley["data"]}
e_names = {f"{r['first_name']} {r['last_name']}" for r in envoy["data"]}
if "Ellis Envoy" in w_names:
    raise SystemExit(f"Woodley session saw Envoy: {w_names}")
if "Willow Woodley" in e_names:
    raise SystemExit(f"Envoy session saw Woodley: {e_names}")
if "Willow Woodley" not in w_names:
    raise SystemExit(f"Woodley missing own contact: {w_names}")
if "Ellis Envoy" not in e_names:
    raise SystemExit(f"Envoy missing own contact: {e_names}")
print("W0 isolation passed: Woodley 100004 cannot see Ellis Envoy.")
PY
