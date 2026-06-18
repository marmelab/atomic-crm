#!/usr/bin/env python3
"""Step 3 Part A - Structural (AST) extraction for code files.

Reads graphify-out/.graphify_detect.json, writes graphify-out/.graphify_ast.json.
"""
import json
from pathlib import Path

from graphify.extract import collect_files, extract

detect = json.loads(Path("graphify-out/.graphify_detect.json").read_text(encoding="utf-8"))

code_files = []
for f in detect.get("files", {}).get("code", []):
    code_files.extend(collect_files(Path(f)) if Path(f).is_dir() else [Path(f)])

if code_files:
    result = extract(code_files, cache_root=Path("."))
    Path("graphify-out/.graphify_ast.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f'AST: {len(result["nodes"])} nodes, {len(result["edges"])} edges')
else:
    Path("graphify-out/.graphify_ast.json").write_text(
        json.dumps(
            {"nodes": [], "edges": [], "input_tokens": 0, "output_tokens": 0},
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print("No code files - skipping AST extraction")
