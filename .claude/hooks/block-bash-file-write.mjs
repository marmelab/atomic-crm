#!/usr/bin/env node
// PreToolUse hook — block file writes via Bash.
// Developers must use Edit/Write tools to modify files. Using bash redirection
// (cat >, echo >, sed -i, etc.) bypasses PostToolUse hooks (prettier, typecheck)
// and leaves orphan temp files in /tmp. Violated in run 2026-04-22-complex-priority
// where a developer ran `cat > /tmp/task-002-update.json` leaving an empty tmp file.
//
// Blocks the Bash call + a clear error message telling the dev to use Edit/Write
// instead. Allows read-only uses (grep, ls, find, cat FOR READING) and
// legitimate git/npm/make commands.
//
// Input on stdin: { session_id, tool_name, tool_input, ... }

import { readStdin, parseJson, crmIdentity, decisionBlock } from "./lib/common.mjs";

const input = parseJson(readStdin());
const ctx = crmIdentity(input);

if (input.tool_name !== "Bash") process.exit(0);

// Subagents only — this enforces "developers must use Edit/Write". The main
// session (no agent_id) is left untouched so interactive Bash is never blocked.
if (!ctx.agentId) process.exit(0);

const cmd = input.tool_input?.command || "";

let blocked = "";

// File-writing redirections: `> path` or `>> path` where path isn't /dev/null
// or a log file. Allow HERE-DOCs being consumed by git/other commands
// (git commit -m "$(cat <<'EOF'\n...\nEOF)") — those use `<<EOF` inside $(...),
// not `> file`.
if (/(^|[^0-9&])>>?\s*(\/[a-zA-Z]|\.\/|[a-zA-Z][a-zA-Z0-9._-]*\.[a-zA-Z]+)/.test(cmd)) {
  // Allow explicit /dev/null
  if (!/>>?\s*\/dev\/null/.test(cmd)) {
    blocked = "bash redirection to file (> or >>). Use Edit or Write tool instead.";
  }
}

// sed -i: in-place file modification
if (!blocked && /sed\s+(-[a-zA-Z]*i\b|--in-place)/.test(cmd)) {
  blocked = "sed -i (in-place edit). Use Edit tool instead.";
}

// awk -i inplace
if (!blocked && /awk\s+-i\s+inplace/.test(cmd)) {
  blocked = "awk -i inplace. Use Edit tool instead.";
}

// tee writing to a file path (not /dev/null)
if (!blocked && /\|\s*tee\s+[^-]/.test(cmd)) {
  if (!/\|\s*tee\s+(\/dev\/null|-a\s+\/dev\/null)/.test(cmd)) {
    blocked = "pipe to tee (file write). Use Write tool instead.";
  }
}

// node / python -e / -c with explicit filesystem write calls
if (!blocked && /(node|python3?)\s+-[ecp].*(writeFileSync|writeFile|write_text|os\.write|fs\.write)/.test(cmd)) {
  blocked = "scripted file write via node/python. Use Write/Edit tool instead.";
}

if (blocked) {
  ctx.log(`block-bash-write BLOCKED cmd=${cmd.slice(0, 120)}`);
  decisionBlock(`File editing via Bash is forbidden: ${blocked} See developer.md's HARD RULE.`);
}

process.exit(0);
