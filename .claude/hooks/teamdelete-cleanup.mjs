#!/usr/bin/env node
// PostToolUse hook for TeamDelete tool.
//
// Runs AFTER a successful TeamDelete to:
//   1. Remove residual disk artifacts (inboxes/, transcripts).
//   2. Write a circuit-breaker flag when TeamDelete found no team
//      (response: "No team name found, nothing to clean up"). This flag is read
//      by teamdelete-gate (PreToolUse) to block the next call, preventing the
//      orchestrator from looping in STATE DONE. The flag is cleared when a real
//      team is deleted, so multi-wave sessions still work correctly.
//
// Behavior:
//   - If tool_response.success is not true → no-op (let user investigate)
//   - If success but no team_name → write empty-flag, skip disk cleanup
//   - If success and team_name present → disk cleanup + clear empty-flag
//   - Always exit 0 — this hook is informational, never blocks
//
// Safety: the team_name regex prevents path traversal. We only ever delete
// inside TEAMS_DIR.

import { existsSync, mkdirSync, rmSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { readStdin, parseJson, crmIdentity, TEAMS_DIR } from "./lib/common.mjs";

const stdin = readStdin();
if (!stdin) process.exit(0);
const input = parseJson(stdin);
const ctx = crmIdentity(input);

const success = input.tool_response?.success === true;
if (!success) {
  ctx.log("teamdelete-cleanup SKIP non-success");
  process.exit(0);
}

const sessionId = input.session_id || "";
const teamName = input.tool_response?.team_name || input.tool_input?.team_name || "";
const emptyFlag = join(ctx.sessionDir, "teamdelete-empty");

if (!teamName) {
  // TeamDelete found no team — write circuit-breaker flag so the gate blocks
  // the next call and prevents a STATE DONE loop.
  if (sessionId) {
    try {
      mkdirSync(ctx.sessionDir, { recursive: true });
      writeFileSync(emptyFlag, "");
      ctx.log(`teamdelete-cleanup SET empty-flag session=${sessionId}`);
    } catch {
      // best-effort
    }
  }
  ctx.log("teamdelete-cleanup SKIP no team_name");
  process.exit(0);
}

// Strict validation: alphanumeric, dash, underscore only. Blocks path traversal.
if (!/^[A-Za-z0-9_-]+$/.test(teamName)) {
  ctx.log(`teamdelete-cleanup REFUSE invalid team_name=${teamName}`);
  process.exit(0);
}

const target = join(TEAMS_DIR, teamName);

// Defensive: only delete if the path is exactly under TEAMS_DIR.
if (!target.startsWith(TEAMS_DIR + "/")) {
  ctx.log(`teamdelete-cleanup REFUSE path outside teams dir: ${target}`);
  process.exit(0);
}

if (existsSync(target)) {
  rmSync(target, { recursive: true, force: true });
  ctx.log(`teamdelete-cleanup REMOVED ${target}`);
  // Real deletion — clear the circuit-breaker flag so the next wave can call
  // TeamCreate + TeamDelete again without being blocked.
  try {
    unlinkSync(emptyFlag);
  } catch {
    // flag absent — fine
  }
} else {
  ctx.log(`teamdelete-cleanup NOOP ${target} (not present)`);
}

process.exit(0);
