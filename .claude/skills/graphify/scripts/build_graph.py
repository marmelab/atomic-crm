#!/usr/bin/env python3
"""Step 4 - Build graph, cluster, analyze, and generate initial outputs.

Usage: build_graph.py [--directed]
  --directed  build a DiGraph that preserves edge direction (source->target).

Reads graphify-out/.graphify_extract.json and .graphify_detect.json.
Writes graphify-out/GRAPH_REPORT.md, graph.json, and .graphify_analysis.json.
Exits 1 (after printing "ERROR: Graph is empty") when extraction produced no nodes.
"""
import json
import sys
from pathlib import Path

from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.export import to_json

directed = "--directed" in sys.argv[1:]

Path("graphify-out").mkdir(exist_ok=True)
extraction = json.loads(Path("graphify-out/.graphify_extract.json").read_text(encoding="utf-8"))
detection = json.loads(Path("graphify-out/.graphify_detect.json").read_text(encoding="utf-8"))

G = build_from_json(extraction, directed=True) if directed else build_from_json(extraction)
communities = cluster(G)
cohesion = score_all(G, communities)
tokens = {"input": extraction.get("input_tokens", 0), "output": extraction.get("output_tokens", 0)}
gods = god_nodes(G)
surprises = surprising_connections(G, communities)
labels = {cid: "Community " + str(cid) for cid in communities}
# Placeholder questions - regenerated with real labels in Step 5
questions = suggest_questions(G, communities, labels)

report = generate(
    G, communities, cohesion, labels, gods, surprises, detection, tokens, ".", suggested_questions=questions
)
Path("graphify-out/GRAPH_REPORT.md").write_text(report, encoding="utf-8")
to_json(G, communities, "graphify-out/graph.json")

analysis = {
    "communities": {str(k): v for k, v in communities.items()},
    "cohesion": {str(k): v for k, v in cohesion.items()},
    "gods": gods,
    "surprises": surprises,
    "questions": questions,
}
Path("graphify-out/.graphify_analysis.json").write_text(
    json.dumps(analysis, indent=2, ensure_ascii=False), encoding="utf-8"
)
if G.number_of_nodes() == 0:
    print("ERROR: Graph is empty - extraction produced no nodes.")
    print("Possible causes: all files were skipped, binary-only corpus, or extraction failed.")
    raise SystemExit(1)
print(f"Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges, {len(communities)} communities")
