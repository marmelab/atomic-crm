#!/usr/bin/env node
// SessionStart: ensure the Playwright MCP browser is provisioned so the harness
// feature-smoke (quality-reviewer MODE: feature-smoke) can DRIVE the app itself.
//
// The server is already wired: .mcp.json declares it (node
// node_modules/@playwright/mcp/cli.js) and the developer / quality-reviewer agents
// carry the mcp__playwright__browser_* tools. The only failure mode seen in the wild
// is a partial `npm install` that never pulled `@playwright/mcp` (or its chromium),
// which silently degrades feature-smoke to static checks. This hook detects that and
// auto-repairs it, so the demo-smoke works without a human running `make install`.
//
// An MCP server connects at SESSION START, before any hook finishes, so a synchronous
// install here could NOT connect the server for THIS session anyway. The right move is
// therefore: detect fast, kick off `make install-playwright-browsers` DETACHED in the
// background (logged), and warn that feature-smoke degrades this session and will work
// the next one. Fast when present (the 99% case), never blocks startup, never throws.

import { existsSync, statSync } from "node:fs";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { createHookContext } from "./lib/context.mjs";

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0); // no payload -> nothing to do
}
const ctx = createHookContext(input, "ensure-playwright-mcp");

const repo = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const mcpCli = join(repo, "node_modules", "@playwright", "mcp", "cli.js");

// Present -> nothing to do. Fast path, no output (avoid per-session noise).
if (existsSync(mcpCli)) {
  ctx.log("playwright MCP present");
  process.exit(0);
}

// A global lock so parallel sessions don't launch duplicate installs. A fresh lock
// (< 30 min) means an install is already running; just warn, don't relaunch.
const lock = "/tmp/atomic-crm-playwright-mcp-install.lock";
let installing = false;
try {
  if (
    existsSync(lock) &&
    Date.now() - statSync(lock).mtimeMs < 30 * 60 * 1000
  ) {
    installing = true;
  }
} catch {
  // ignore -> treat as not installing
}

const installLog = join(ctx.sessionDir, "playwright-mcp-install.log");

if (!installing && process.env.PLAYWRIGHT_MCP_CHECK_ONLY !== "1") {
  try {
    // Detached: returns immediately, survives this hook's exit. `make
    // install-playwright-browsers` runs `npm install` then `npx playwright install
    // chromium chromium-headless-shell`; provisions both the MCP package and browsers.
    const cmd = `touch "${lock}"; make -C "${repo}" install-playwright-browsers > "${installLog}" 2>&1; rm -f "${lock}"`;
    const child = spawn("bash", ["-lc", cmd], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    ctx.log(
      `playwright MCP missing -> background install started, log=${installLog}`,
    );
  } catch (e) {
    ctx.log(
      `playwright MCP missing -> could not start install: ${e?.message ?? e}`,
    );
  }
} else {
  ctx.log("playwright MCP missing -> install already in progress");
}

// Warn the session: the MCP cannot connect mid-session, so feature-smoke degrades to
// static checks THIS run; it will drive the browser once the install completes.
process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext:
        `<playwright-mcp-status>NOT INSTALLED. The Playwright MCP browser is being ` +
        `provisioned in the background (log: ${installLog}). For THIS session the harness ` +
        `feature-smoke (MODE: feature-smoke) cannot drive the UI and will fall back to ` +
        `static/compile checks; the Supabase e2e-smoke (CLI Playwright) is unaffected. It ` +
        `will be available next session. To provision now: run \`make install-playwright-browsers\`.` +
        `</playwright-mcp-status>`,
    },
  }) + "\n",
);
process.exit(0);
