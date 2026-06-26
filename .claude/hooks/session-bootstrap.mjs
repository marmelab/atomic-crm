#!/usr/bin/env node
// SessionStart — bootstrap the harness session context so the orchestrator (or the
// main thread acting as one) can run on ANY Claude Code surface (CLI, VS Code
// extension, desktop), not only via a launch script that injects
// --append-system-prompt.
//
// It injects `<session_dir>` via hookSpecificOutput.additionalContext, derived
// from the REAL session id the harness assigns. Because every other hook
// (setup-worktree, merger, ...) also keys off that same real session id, the
// alignment invariant `basename(session_dir) == session_id` holds by construction
// — no minted UUID, no forced --session-id.

// Pure env-inspection + additionalContext: no MCP calls (MCP may be disabled in
// hosted/headless runs), no git mutation, never throws.

import { readFileSync, mkdirSync } from "node:fs";
import { createHookContext } from "./lib/context.mjs";

// A managed launcher owns the session context — stay out of its way.
if (process.env.CHAT_SESSION_DIR) process.exit(0);

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  // no payload → nothing to inject
  process.exit(0);
}

const ctx = createHookContext(input, "session-bootstrap");

// Use the SAME per-session dir that setup-worktree builds its worktrees under
// (ctx.sessionDir = /tmp/<sanitized repo>/<session_id>, via context.mjs). Its
// BASENAME is the real session id — what the orchestrator turns into
// SESSION_SHORT_ID and WORKTREE_BASE — so the alignment holds and tickets/logs
// share the one session namespace instead of a separate root.
const sessionDir = ctx.sessionDir;
try {
  mkdirSync(sessionDir, { recursive: true });
} catch {
  // best-effort: the orchestrator/agents recreate it as needed
}

ctx.log(`SESSION-BOOTSTRAP session_dir=${sessionDir}`);

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: `<session_dir>${sessionDir}</session_dir>`,
    },
  }) + "\n",
);
process.exit(0);
