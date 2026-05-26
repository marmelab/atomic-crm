#!/usr/bin/env node
// PreToolUse hook — blocks commands that open browser windows.
// Rules: Playwright without --headless, Vite with --open.

import { readStdin, parseJson, decisionBlock } from "./lib/common.mjs";

const input = parseJson(readStdin());
const command = input.tool_input?.command || "";

if (!command) process.exit(0);

// Playwright: must always use --headless
if (/playwright/.test(command)) {
  if (/(screenshot|test|codegen)/.test(command) && !command.includes("--headless")) {
    decisionBlock("Playwright must always use --headless. Add --headless to the command.");
    process.exit(0);
  }
}

// Vite: forbid --open
if (/vite|npm run (dev|start|start-demo)/.test(command)) {
  if (command.includes("--open")) {
    decisionBlock("Vite must not use --open (opens a browser window). Remove the --open flag.");
    process.exit(0);
  }
}

process.exit(0);
