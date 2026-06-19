#!/usr/bin/env python3
"""Step 2 - Detect files in the corpus.

Usage: detect.py <INPUT_PATH>
Writes graphify-out/.graphify_detect.json (silently - the skill reads it, never cats it).
"""
import json
import sys
from pathlib import Path

from graphify.detect import detect

input_path = sys.argv[1]
result = detect(Path(input_path))
Path("graphify-out/.graphify_detect.json").write_text(
    json.dumps(result, ensure_ascii=False), encoding="utf-8"
)
