#!/usr/bin/env bash
# Interpreter guard for subcommands - re-resolve the interpreter and skill
# directory when graphify-out/.graphify_python is missing (e.g. the user deleted
# graphify-out/). Does NOT install graphify; assumes it is already installed.

GRAPHIFY_BIN=$(which graphify 2>/dev/null)
if [ -n "$GRAPHIFY_BIN" ]; then
    PYTHON=$(head -1 "$GRAPHIFY_BIN" | tr -d '#!')
    case "$PYTHON" in *[!a-zA-Z0-9/_.-]*) PYTHON="python3" ;; esac
else
    PYTHON="python3"
fi
mkdir -p graphify-out
"$PYTHON" -c "import sys; open('graphify-out/.graphify_python', 'w', encoding='utf-8').write(sys.executable)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dirname "$SCRIPT_DIR" > graphify-out/.graphify_dir
