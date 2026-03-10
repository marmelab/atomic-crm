#!/bin/bash
# Hook input is provided on stdin as JSON by Claude Code
input=$(cat)

# Extract file path from the tool_input
file_path=$(node -e "const i=JSON.parse(process.argv[1]);console.log((i.tool_input&&(i.tool_input.file_path||i.tool_input.notebook_path))||'')" "$input")

# Only format files with supported extensions
if echo "$file_path" | grep -qE '\.(ts|tsx|js|jsx|json|css|md|html)$'; then
  npx prettier --write "$file_path"
fi
