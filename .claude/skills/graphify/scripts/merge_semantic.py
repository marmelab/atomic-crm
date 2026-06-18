#!/usr/bin/env python3
"""Step 3 Part B3 - Merge cached + newly extracted semantic results.

Writes graphify-out/.graphify_semantic.json.
"""
import json
from pathlib import Path

cached_p = Path("graphify-out/.graphify_cached.json")
new_p = Path("graphify-out/.graphify_semantic_new.json")
cached = (
    json.loads(cached_p.read_text(encoding="utf-8"))
    if cached_p.exists()
    else {"nodes": [], "edges": [], "hyperedges": []}
)
new = (
    json.loads(new_p.read_text(encoding="utf-8"))
    if new_p.exists()
    else {"nodes": [], "edges": [], "hyperedges": []}
)

all_nodes = cached["nodes"] + new.get("nodes", [])
all_edges = cached["edges"] + new.get("edges", [])
all_hyperedges = cached.get("hyperedges", []) + new.get("hyperedges", [])
seen = set()
deduped = []
for n in all_nodes:
    if n["id"] not in seen:
        seen.add(n["id"])
        deduped.append(n)

merged = {
    "nodes": deduped,
    "edges": all_edges,
    "hyperedges": all_hyperedges,
    "input_tokens": new.get("input_tokens", 0),
    "output_tokens": new.get("output_tokens", 0),
}
Path("graphify-out/.graphify_semantic.json").write_text(
    json.dumps(merged, indent=2, ensure_ascii=False), encoding="utf-8"
)
print(
    f"Extraction complete - {len(deduped)} nodes, {len(all_edges)} edges "
    f'({len(cached["nodes"])} from cache, {len(new.get("nodes", []))} new)'
)
