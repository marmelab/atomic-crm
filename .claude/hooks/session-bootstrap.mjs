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
import { detectInflight } from "./lib/session-state.mjs";

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

// Resume banner: on a RESUMED session (same id → same namespace), the previous
// orchestrator process is gone and nothing re-launches it, so an interrupted
// harness would otherwise sit dead. If THIS session has in-flight harness state
// on disk/git, tell the main thread to re-dispatch a FRESH recovery orchestrator
// (never SendMessage the dead one). Keyed only on this session id — a fresh or
// unrelated concurrent session has no state under its id and gets no banner.
let resume = "";
try {
  const { inflight, phase } = detectInflight(ctx);
  if (inflight === true) {
    ctx.log(`SESSION-BOOTSTRAP resume-available phase=${phase}`);
    resume =
      `\n<harness_resume>` +
      `An interrupted harness session was detected for THIS session (short id \`${ctx.sessionShort}\`), paused at: ${phase}. ` +
      `Its orchestrator process ended when the window last closed; nothing is running now. ` +
      `To resume, dispatch a FRESH orchestrator with <intent>recovery</intent> and this same session_dir. ` +
      `Do NOT SendMessage a previous orchestrator (it is dead). See CLAUDE.md "Resuming after a restart".` +
      `</harness_resume>`;
  }
} catch {
  // detection must never break bootstrap
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: `<session_dir>${sessionDir}</session_dir>${resume}`,
    },
  }) + "\n",
);
process.exit(0);
