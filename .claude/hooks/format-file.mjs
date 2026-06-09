#!/usr/bin/env node
// PostToolUse hook — runs prettier --write on the file a Write/Edit just touched.
// (Not currently wired in settings.json; kept for ad-hoc use.)

import { readStdin, parseJson, exec } from "./lib/common.mjs";

const input = parseJson(readStdin());
const filePath = input.tool_input?.file_path || input.tool_input?.notebook_path || "";

// Only format files with supported extensions.
if (/\.(ts|tsx|js|jsx|json|css|md|html)$/.test(filePath)) {
  exec("npx", ["prettier", "--write", filePath]);
}
