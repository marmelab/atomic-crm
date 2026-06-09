#!/usr/bin/env node
// PreToolUse hook for TeamCreate.
//
// Wipes orphan teams (those owned by a different session) before TeamCreate
// runs, so the new team can claim the requested team_name verbatim. Without
// this, Claude CLI's collision handling assigns a random unique team_name
// (e.g. "ancient-drifting-coral") and subsequent Agent({team_name: "tickets"})
// calls keep routing into the stale team — the new members get auto-suffixed
// (`-2`, `-3`, …) and SendMessages from the developer route to dead members
// from prior crashed sessions.
//
// Why a hook, not a skill instruction: we tried having the team-lead call
// TeamDelete({team_name: "tickets"}) as preflight; the LLM dropped the argument
// and called TeamDelete({}) instead (a no-op). This hook is the deterministic
// safety net.
//
// Safety:
// - Only wipes if `leadSessionId` in the team's config differs from the current
//   session's `session_id`. A team owned by THIS session is live and must go
//   through graceful shutdown (teamdelete-gate enforces that).
// - team_name is regex-validated to prevent path traversal.
// - Always exits 0 — never blocks TeamCreate.

import { existsSync, rmSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { readStdin, parseJson, crmIdentity, readJson, TEAMS_DIR } from "./lib/common.mjs";

const stdin = readStdin();
if (!stdin) process.exit(0);
const input = parseJson(stdin);
const ctx = crmIdentity(input);

const teamName = input.tool_input?.team_name || "";
const sessionId = input.session_id || "";

if (!teamName) process.exit(0);
if (!sessionId) process.exit(0);

// Strict regex — must match the same charset accepted by teamdelete-cleanup.
if (!/^[A-Za-z0-9_-]+$/.test(teamName)) process.exit(0);

const target = join(TEAMS_DIR, teamName);
const config = join(target, "config.json");

if (!existsSync(config)) process.exit(0);

const leadOfTeam = readJson(config)?.leadSessionId || "";

// Empty leadSessionId is exactly the orphan/corrupt case (partial config write,
// older CLI build). Treat the same as a different-session lead — wipe so the
// next TeamCreate can claim the name. Only skip wipe when the team is owned by
// THIS session (live → graceful shutdown owned by teamdelete-gate).
if (leadOfTeam === sessionId) process.exit(0);

// Defensive: only delete inside TEAMS_DIR.
if (!target.startsWith(TEAMS_DIR + "/")) process.exit(0);

rmSync(target, { recursive: true, force: true });
ctx.log(`teamcreate-wipe-orphan REMOVED ${target} (orphan leadSession=${leadOfTeam} current=${sessionId})`);

// Clear the circuit-breaker flag for this session if it was set by an earlier
// teamdelete-cleanup "no team" path — the upcoming TeamCreate is genuine and
// the next TeamDelete (Phase 3) should not be blocked.
try {
  unlinkSync(join(ctx.sessionDir, "teamdelete-empty"));
} catch {
  // flag absent — nothing to clear
}

process.exit(0);
