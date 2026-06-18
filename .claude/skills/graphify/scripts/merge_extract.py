#!/usr/bin/env python3
"""Step 3 Part C - Merge AST + semantic extraction into the final extraction file.

Writes graphify-out/.graphify_extract.json.
"""
import json
from pathlib import Path

ast = json.loads(Path("graphify-out/.graphify_ast.json").read_text(encoding="utf-8"))
sem = json.loads(Path("graphify-out/.graphify_semantic.json").read_text(encoding="utf-8"))

# AST nodes first, semantic nodes deduplicated by id
seen = {n["id"] for n in ast["nodes"]}
merged_nodes = list(ast["nodes"])
for n in sem["nodes"]:
    if n["id"] not in seen:
        merged_nodes.append(n)
        seen.add(n["id"])

merged = {
    "nodes": merged_nodes,
    "edges": ast["edges"] + sem["edges"],
    "hyperedges": sem.get("hyperedges", []),
    "input_tokens": sem.get("input_tokens", 0),
    "output_tokens": sem.get("output_tokens", 0),
}
Path("graphify-out/.graphify_extract.json").write_text(
    json.dumps(merged, indent=2, ensure_ascii=False), encoding="utf-8"
)
print(
    f'Merged: {len(merged_nodes)} nodes, {len(merged["edges"])} edges '
    f'({len(ast["nodes"])} AST + {len(sem["nodes"])} semantic)'
)
