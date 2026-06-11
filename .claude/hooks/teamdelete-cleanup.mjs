#!/usr/bin/env node
// PostToolUse(TeamDelete) — remove residual team disk artifacts after a successful
// TeamDelete, so stale ~/.claude/teams/<team>/ directories don't accumulate.
//
// Disk-cleanup only. The old STATE-DONE anti-loop flag is intentionally gone: its
// only reader was teamdelete-gate.mjs, removed in the native-Teams model (TeamDelete
// errors when members are still busy, so the orchestrator no longer loops here).
//
// Always exits 0 — this hook is informational and never blocks.
// Safety: the team_name is validated (alphanumeric/dash/underscore) and the target
// path is asserted to live strictly under TEAMS_DIR, blocking path traversal.

import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createHookContext } from "./lib/context.mjs";
import { TEAMS_DIR } from "./lib/paths.mjs";
import { isValidTeamName } from "./lib/teams.mjs";

const stdin = readFileSync(0, "utf8");
if (!stdin) process.exit(0);
const input = JSON.parse(stdin);
const ctx = createHookContext(input, "teamdelete-cleanup");

if (input.tool_response?.success !== true) {
  ctx.log("SKIP non-success");
  process.exit(0);
}

const teamName =
  input.tool_response?.team_name || input.tool_input?.team_name || "";
if (!teamName) {
  ctx.log("SKIP no team_name");
  process.exit(0);
}

if (!isValidTeamName(teamName)) {
  ctx.log(`REFUSE invalid team_name=${teamName}`);
  process.exit(0);
}

const target = join(TEAMS_DIR, teamName);

// Defensive: only delete if the path is exactly under TEAMS_DIR.
if (!target.startsWith(TEAMS_DIR + "/")) {
  ctx.log(`REFUSE path outside teams dir: ${target}`);
  process.exit(0);
}

if (existsSync(target)) {
  rmSync(target, { recursive: true, force: true });
  ctx.log(`REMOVED ${target}`);
} else {
  ctx.log(`NOOP ${target} (not present)`);
}

process.exit(0);
