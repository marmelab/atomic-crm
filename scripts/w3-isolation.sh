#!/usr/bin/env bash
# BFF saved views stay on the stub principal.
set -euo pipefail
BFF_URL="${CRM_BFF_URL:-http://127.0.0.1:8787}"

woodley="$(curl -sf -H 'x-ardley-customer-id: 100004' "${BFF_URL}/saved-views")"
envoy="$(curl -sf -H 'x-ardley-customer-id: 100081' "${BFF_URL}/saved-views")"

python3 - "$woodley" "$envoy" <<'PY'
import json, sys
woodley = json.loads(sys.argv[1])
envoy = json.loads(sys.argv[2])
by_name = {v["name"]: v for v in woodley["data"]}
need = {"My Borrowers", "My Paired Agents", "In-process loans", "Recruiting"}
if set(by_name) != need:
    raise SystemExit(f"unexpected views: {sorted(by_name)}")
borrowers = {r["label"] for r in by_name["My Borrowers"]["results"]}
if "Willow Woodley" not in borrowers or "Blair Borrower" not in borrowers:
    raise SystemExit(f"borrowers: {borrowers}")
if "Ellis Envoy" in borrowers:
    raise SystemExit("Woodley view leaked Envoy")
if "Willow Woodley" not in borrowers:
    raise SystemExit(f"borrowers missing Willow: {borrowers}")
agents = {r["label"] for r in by_name["My Paired Agents"]["results"]}
if "Avery Agent" not in agents or "Riley Agent" not in agents:
    raise SystemExit(f"paired agents: {agents}")
loans = {r["label"].split(" · ")[0] for r in by_name["In-process loans"]["results"]}
if "Willow purchase" not in loans or "Blair refinance" not in loans:
    raise SystemExit(f"in-process: {loans}")
if envoy["total"] != 0:
    raise SystemExit(f"Envoy should have no saved views: {envoy}")
print("W3 isolation passed: saved views stay on Woodley.")
PY
