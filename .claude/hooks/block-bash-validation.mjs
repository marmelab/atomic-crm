#!/usr/bin/env node
// PreToolUse hook — block subagents from running validation commands via Bash.
// These are already run by SubagentStop hooks (typecheck, prettier, unit tests,
// e2e). A subagent running them manually:
//   - wastes Bash budget (circuit breaker)
//   - hangs on `npx vitest` without CI=true (chromium headed mode attempts
//     to launch without display → infinite wait)
//   - produces redundant results that may conflict with hook output
//
// Blocks with a clear reason so the subagent knows to stop running these and
// trust the hook output.
//
// Input on stdin: { session_id, tool_name, tool_input, agent_type, ... }

import { readStdin, parseJson, crmIdentity, decisionBlock } from "./lib/common.mjs";

const input = parseJson(readStdin());
const ctx = crmIdentity(input);

const tool = input.tool_name || "";
const agent = input.agent_type || "";
const cmd = input.tool_input?.command || "";

if (tool !== "Bash") process.exit(0);

// Only block for subagents whose prompt forbids validation commands.
// The orchestrator (no agent_type) and planner/merger/project-manager are
// allowed. simple-developer is also blocked — SubagentStop hooks (wired in
// settings.json with matcher "simple-developer") do the validation; the
// agent should not run them inline. Claude Code's PreToolUse hook matcher
// filters on tool_name only — agent-type filtering must happen here.
if (!["developer", "quality-reviewer", "test-validator", "simple-developer"].includes(agent)) {
  process.exit(0);
}

// Patterns to block — each matches a specific kind of validation command.
// Use word boundaries where possible to avoid false positives (e.g., block
// `npm run test:unit:app` but not `git log src/tests/...`).
let blocked = "";

if (/(make\s+typecheck|npm\s+run\s+typecheck|npx\s+tsc(\s|$)|tsc\s+--noEmit)/.test(cmd)) {
  blocked =
    "typecheck — the typecheck-on-commit.mjs hook runs this automatically after you finish; read its stderr output instead.";
}

if (!blocked && /(npm\s+run\s+prettier(:apply)?|npx\s+prettier(\s|$)|make\s+prettier)/.test(cmd)) {
  blocked =
    "prettier — the prettier-on-stop.mjs hook runs this automatically; read its stderr output instead.";
}

if (
  !blocked &&
  /(npm\s+run\s+test(:unit)?(:[a-z]+)?|npm\s+test\b|npx\s+vitest|make\s+test(-unit)?(-[a-z]+)?)/.test(cmd)
) {
  blocked =
    "unit tests — the run-unit-tests-*.mjs hooks run these automatically. In this sandbox vitest browser mode HANGS without CI=true (chromium headed waits for display). Trust the hooks.";
}

if (!blocked && /(npx\s+playwright\s+test|make\s+test-e2e)/.test(cmd)) {
  blocked =
    "e2e tests — the run-e2e-tests.mjs hook runs these in full mode only; in demo mode they're skipped. Don't run them manually.";
}

if (!blocked && /(make\s+lint\b|npm\s+run\s+lint\b)/.test(cmd)) {
  blocked =
    "lint — prettier is already run by prettier-on-stop.mjs; eslint runs via the project's editor config. Skip it.";
}

if (blocked) {
  ctx.log(`block-bash-validation BLOCKED cmd=${cmd.slice(0, 120)}`);
  decisionBlock(`Validation command forbidden: ${blocked} See developer.md "Validation commands — DO NOT RUN THEM".`);
}

process.exit(0);
