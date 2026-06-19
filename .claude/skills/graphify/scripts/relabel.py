#!/usr/bin/env python3
"""Step 5 - Regenerate the report with human-chosen community labels.

Before running this, the skill writes the chosen labels to
graphify-out/.graphify_labels.json as a JSON object mapping community id (string)
to a 2-5 word name, e.g. {"0": "Attention Mechanism", "1": "Training Pipeline"}.

This script reads those labels, regenerates GRAPH_REPORT.md and the suggested
questions (labels affect question phrasing), and normalizes the labels file for
the visualizer.
"""
import json
from pathlib import Path

from graphify.build import build_from_json
from graphify.analyze import suggest_questions
from graphify.report import generate

extraction = json.loads(Path("graphify-out/.graphify_extract.json").read_text(encoding="utf-8"))
detection = json.loads(Path("graphify-out/.graphify_detect.json").read_text(encoding="utf-8"))
analysis = json.loads(Path("graphify-out/.graphify_analysis.json").read_text(encoding="utf-8"))
raw_labels = json.loads(Path("graphify-out/.graphify_labels.json").read_text(encoding="utf-8"))
labels = {int(k): v for k, v in raw_labels.items()}

G = build_from_json(extraction)
communities = {int(k): v for k, v in analysis["communities"].items()}
cohesion = {int(k): v for k, v in analysis["cohesion"].items()}
tokens = {"input": extraction.get("input_tokens", 0), "output": extraction.get("output_tokens", 0)}

# Regenerate questions with real community labels (labels affect question phrasing)
questions = suggest_questions(G, communities, labels)

report = generate(
    G,
    communities,
    cohesion,
    labels,
    analysis["gods"],
    analysis["surprises"],
    detection,
    tokens,
    ".",
    suggested_questions=questions,
)
Path("graphify-out/GRAPH_REPORT.md").write_text(report, encoding="utf-8")
Path("graphify-out/.graphify_labels.json").write_text(
    json.dumps({str(k): v for k, v in labels.items()}, ensure_ascii=False), encoding="utf-8"
)
print("Report updated with community labels")
