#!/usr/bin/env python3
"""Step 3 Part B3 - Save newly extracted semantic results to the cache.

Reads graphify-out/.graphify_semantic_new.json.
"""
import json
from pathlib import Path

from graphify.cache import save_semantic_cache

p = Path("graphify-out/.graphify_semantic_new.json")
new = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {"nodes": [], "edges": [], "hyperedges": []}
saved = save_semantic_cache(new.get("nodes", []), new.get("edges", []), new.get("hyperedges", []))
print(f"Cached {saved} files")
