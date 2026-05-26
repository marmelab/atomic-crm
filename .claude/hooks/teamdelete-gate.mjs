#!/usr/bin/env node
// PreToolUse hook for TeamDelete tool.
//
// Two guards, checked in order:
//
// 1. Circuit-breaker: if PostToolUse already flagged that the last TeamDelete
//    found no team, block immediately with a STATE DONE message. This prevents
//    the orchestrator from looping in STATE DONE after all waves are complete.
//    Flag file: <sessionDir>/teamdelete-empty (written by teamdelete-cleanup).
//
// 2. Member shutdown check: blocks TeamDelete if any non-lead member has not
//    been gracefully shut down. Points to the agent-team skill Phase 3 protocol.
//
// Behavior:
//   - exit 0 → allow TeamDelete
//   - exit 2 → block with stderr pointing to the missing step

import { existsSync } from "node:fs";
import { dirname, basename, join } from "node:path";
import { readStdin, parseJson, crmIdentity, readJson, teamConfigs, TEAMS_DIR } from "./lib/common.mjs";

const stdin = readStdin();
if (!stdin) process.exit(0);
const input = parseJson(stdin);
const ctx = crmIdentity(input);

const teamName = input.tool_input?.team_name || "";
const sessionId = input.session_id || "";

// Guard 1 — circuit-breaker: block if the previous TeamDelete already found no team.
if (sessionId) {
  if (existsSync(join(ctx.sessionDir, "teamdelete-empty"))) {
    ctx.log(`teamdelete-gate BLOCK circuit-breaker session=${sessionId}`);
    process.stderr.write(
      [
        "TeamDelete blocked: the previous call already returned 'no team found'.",
        "You are in STATE DONE — do not call TeamDelete again.",
        "The session's work is complete. Report done to the user and stop.",
      ].join("\n") + "\n"
    );
    process.exit(2);
  }
}

if (!existsSync(TEAMS_DIR)) process.exit(0);

// Resolve the team to inspect.
let teamDir;
if (teamName) {
  teamDir = join(TEAMS_DIR, teamName);
} else {
  // TeamDelete({}) — find the unique team owned by this session.
  const matches = teamConfigs().filter((cfg) => (readJson(cfg)?.leadSessionId || "") === sessionId);
  // 0 → no team for this session (guard 1 handles the loop case; allow here).
  // 2+ → ambiguous, runtime will respond. 1 → use it.
  if (matches.length !== 1) process.exit(0);
  teamDir = dirname(matches[0]);
}

const config = join(teamDir, "config.json");
const leadInbox = join(teamDir, "inboxes", "team-lead.json");

if (!existsSync(config)) process.exit(0);
const team = basename(teamDir);

// Orphan bypass: if the team was created by a different session (lead crashed,
// user STOPped, container restarted), graceful shutdown is impossible — the
// prior members are dead processes that will never ack a shutdown_request.
// Allow the deletion so the next wave can claim a clean `tickets` team.
const leadOfTeam = readJson(config)?.leadSessionId || "";
if (leadOfTeam && sessionId && leadOfTeam !== sessionId) {
  ctx.log(`teamdelete-gate ALLOW orphan team=${team} leadSession=${leadOfTeam} current=${sessionId}`);
  process.exit(0);
}

// Non-lead members.
const members = (readJson(config)?.members || [])
  .filter((m) => m && m.agentType !== "team-lead" && m.name)
  .map((m) => m.name);
if (members.length === 0) process.exit(0);

// Lead inbox may not yet exist if no message has reached the lead. Treat as
// "no approvals received" rather than aborting.
const inbox = existsSync(leadInbox) ? readJson(leadInbox) || [] : null;

const pendingNoApproval = []; // No shutdown_approved at all
const pendingNoYield = []; // shutdown_approved present but read:false

for (const m of members) {
  if (inbox === null) {
    pendingNoApproval.push(m);
    continue;
  }
  const matching = (Array.isArray(inbox) ? inbox : []).filter(
    (e) => e && e.from === m && (e.text || "").includes("shutdown_approved")
  );
  if (matching.length === 0) {
    pendingNoApproval.push(m);
    continue;
  }
  const latestRead = matching[matching.length - 1].read === true;
  if (!latestRead) pendingNoYield.push(m);
}

const total = pendingNoApproval.length + pendingNoYield.length;
if (total === 0) {
  ctx.log(`teamdelete-gate ALLOW team=${team}`);
  process.exit(0);
}

ctx.log(
  `teamdelete-gate BLOCK team=${team} no_approval=${pendingNoApproval.join(" ")} no_yield=${pendingNoYield.join(" ")}`
);

const lines = [`TeamDelete blocked: ${total} teammate(s) in team '${team}' have not been gracefully shut down.`, ""];
if (pendingNoApproval.length > 0) {
  lines.push("No shutdown_approved received from (Step 3a missing or in flight):");
  for (const m of pendingNoApproval) lines.push(`  - ${m}`);
  lines.push("");
  lines.push("Step 3a — Send shutdown_request to each pending member, in ONE assistant message:");
  for (const m of pendingNoApproval) lines.push(`  SendMessage({to: "${m}", message: {"type": "shutdown_request"}})`);
  lines.push("");
}
if (pendingNoYield.length > 0) {
  lines.push("shutdown_approved present but unread (Step 3b missing):");
  for (const m of pendingNoYield) lines.push(`  - ${m}`);
  lines.push("");
}
lines.push("Step 3b — Emit a brief assistant text and STOP. Do NOT call any other tool in this turn.");
lines.push("          Yielding the turn is what lets the runtime deliver shutdown_approved replies.");
lines.push("Step 3c — On the NEXT turn, the runtime injects <teammate-message> blocks marking");
lines.push("          shutdown_approved as read.");
lines.push("Step 3d — Then retry TeamDelete.");
lines.push("");
lines.push("DO NOT call TeamDelete again immediately — without yielding it will fail the same way.");

process.stderr.write(lines.join("\n") + "\n");
process.exit(2);
