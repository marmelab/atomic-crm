#!/usr/bin/env node
// PreToolUse(Bash) — single guard for Bash commands. Blocks commands that open browser windows (headed Playwright, Vite --open) for every caller, and blocks gated subagents from running validation commands (validate-on-stop.mjs runs them automatically on SubagentStop).

import { readFileSync } from "node:fs";
import { createHookContext } from "./lib/context.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "bash-guard");

const agent = input.agent_type || "";
const cmd = input.tool_input?.command || "";

if (!cmd) process.exit(0);

// Browser rules — any caller: this sandbox has no display, a headed run hangs forever.
const opensHeadedPlaywright = (c) =>
  /playwright/.test(c) &&
  /(screenshot|test|codegen)/.test(c) &&
  !c.includes("--headless");
const opensViteBrowser = (c) =>
  /(vite|npm run (dev|start|start-demo))/.test(c) && c.includes("--open");

const BROWSER_RULES = [
  [
    opensHeadedPlaywright,
    "Playwright must always use --headless. Add --headless to the command.",
  ],
  [
    opensViteBrowser,
    "Vite must not use --open (opens a browser window). Remove the --open flag.",
  ],
];

const browserViolation = BROWSER_RULES.find(([matches]) => matches(cmd));
if (browserViolation) {
  ctx.block({
    reason: browserViolation[1],
    log: `browser cmd=${cmd.slice(0, 120)}`,
  });
}

// Validation rules — gated subagents only: the validation hooks already run
// these; manual runs burn budget and can hang (vitest headed without CI=true).
const GATED_AGENTS = ["developer", "quality-reviewer"];
if (!GATED_AGENTS.includes(agent)) process.exit(0);

const runsTypecheck = (c) =>
  /(make\s+typecheck|npm\s+run\s+typecheck|npx\s+tsc(\s|$)|tsc\s+--noEmit)/.test(
    c,
  );
const runsPrettier = (c) =>
  /(npm\s+run\s+prettier(:apply)?|npx\s+prettier(\s|$)|make\s+prettier)/.test(
    c,
  );
const runsUnitTests = (c) =>
  /(npm\s+run\s+test(:unit)?(:[a-z]+)?|npm\s+test\b|npx\s+vitest|make\s+test(-unit)?(-[a-z]+)?)/.test(
    c,
  );
const runsE2eTests = (c) => /(npx\s+playwright\s+test|make\s+test-e2e)/.test(c);
const runsLint = (c) => /(make\s+lint\b|npm\s+run\s+lint\b)/.test(c);
const runsBuild = (c) =>
  /(npx\s+vite\s+build|npm\s+run\s+build\b|make\s+build\b)/.test(c);

const VALIDATION_RULES = [
  [
    runsTypecheck,
    "typecheck — validate-on-stop.mjs runs this automatically after you stop; read its stderr output instead.",
  ],
  [
    runsPrettier,
    "prettier — the validation hooks auto-apply prettier and commit the result; don't run it manually.",
  ],
  [
    runsUnitTests,
    "unit tests — the validation hooks run vitest automatically. In this sandbox vitest browser mode HANGS without CI=true (chromium headed waits for display). Trust the hooks.",
  ],
  [
    runsE2eTests,
    "e2e tests — the validation hooks run playwright in full mode only; in demo mode they're skipped. Don't run them manually.",
  ],
  [
    runsLint,
    "lint — prettier is auto-applied by the validation hooks; eslint runs via the project's editor config. Skip it.",
  ],
  [
    runsBuild,
    "build — don't run production builds during tickets; typecheck (run by the validation hooks) catches type errors.",
  ],
];

const violation = VALIDATION_RULES.find(([matches]) => matches(cmd));
if (violation) {
  ctx.block({
    reason: `Validation command forbidden: ${violation[1]} See .claude/rules/validation-commands.md.`,
    log: `cmd=${cmd.slice(0, 120)}`,
  });
}

process.exit(0);
