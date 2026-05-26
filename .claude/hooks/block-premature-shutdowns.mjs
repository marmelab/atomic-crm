#!/usr/bin/env node
// PreToolUse hook — block ANY SendMessage(shutdown_request) when no merge report
// has yet arrived in the team-lead's inbox.
//
// Safety-net role: the orchestrator's prompt and the agent-team skill describe
// the correct flow (Phase 1 dispatches → wait → Phase 3 teardown after merger
// reports). This hook is the runtime guardrail in case the model collapses
// Phase 1 and Phase 3 into a single turn: if any shutdown_request is sent before
// the merger has produced even one merged/merge-failed report, it is blocked.
//
// Generalized from "merger-only" to "all members" because the developer must
// converse with reviewers BEFORE notifying the merger; pre-emptively shutting
// reviewers down would break the review loop.
//
// Exits 2 with a stderr message pointing to the agent-team skill.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { readStdin, parseJson, crmIdentity, readJson, teamConfigs, TEAMS_DIR } from "./lib/common.mjs";

const input = parseJson(readStdin());
const ctx = crmIdentity(input);

const ti = input.tool_input || {};
const tool = input.tool_name || "";
const to = ti.to || "";
const msg = typeof ti.message === "string" ? ti.message : ti.message ? JSON.stringify(ti.message) : "";
const sessionId = input.session_id || "";

if (tool !== "SendMessage") process.exit(0);

// Only gate when the message is a shutdown_request.
if (!msg.includes("shutdown_request")) process.exit(0);

// Resolve the team. SendMessage's tool_input has no team_name. Resolution order:
//   1. tickets-<sessionShort> derived from the session id.
//   2. leadSessionId in config.json — covers the orchestrator when the session
//      id isn't propagated to the team config.
// Failing both, exit 0 (fails open for non-lead senders).
let team = ti.team_name || "";
if (!team || /[^A-Za-z0-9_-]/.test(team)) {
  team = "";
  if (ctx.sessionShort && existsSync(join(TEAMS_DIR, `tickets-${ctx.sessionShort}`))) {
    team = `tickets-${ctx.sessionShort}`;
  }
  if (!team && sessionId && existsSync(TEAMS_DIR)) {
    for (const cfg of teamConfigs()) {
      if ((readJson(cfg)?.leadSessionId || "") === sessionId) {
        team = basename(dirname(cfg));
        break;
      }
    }
  }
}

if (!team) process.exit(0); // No team for this session — nothing to gate against.

const inboxPath = join(TEAMS_DIR, team, "inboxes", "team-lead.json");
const inboxExists = existsSync(inboxPath);

const blockWithReason = (reason) => {
  process.stderr.write(
    `[block-premature-shutdowns] Blocked: SendMessage(to: "${to}", shutdown_request)
before any merge has been reported.

${reason}

In the agent-team workflow, shutdowns are Phase 3 — they only happen AFTER
the merger has reported "merged TASK-XXX" or "TASK-XXX merge failed" to
team-lead, ONCE per ticket of the wave. Sending shutdowns before any merge
report exists collapses Phase 1 and Phase 3 into a single turn, which kills
the team before the developer↔reviewer↔merger conversation can complete.

Required action: yield this turn (end with text only — no further tool calls)
and wait for the merger's reports. The runtime will deliver them as
<teammate-message teammate_id="merger"> blocks on a future turn. Only then
issue Phase 3 shutdowns to all members in one batch.

See chat-orchestrator.md "Trigger condition for Phase 3 — strict" and
agent-team skill Phase 3.
`
  );
};

// Check 1: inbox messages from the merger reporting a merge result.
let inboxCount = 0;
if (inboxExists) {
  const inbox = readJson(inboxPath) || [];
  for (const entry of Array.isArray(inbox) ? inbox : []) {
    if ((entry.from || "") !== "merger") continue;
    const text = (entry.text || entry.message || "").toString();
    if (/(^|\s)merged\s+TASK-/.test(text) || /merge\s+failed/.test(text) || /TASK-[A-Za-z0-9_-]+\s+merge\s+failed/.test(text)) {
      inboxCount++;
    }
  }
}

if (inboxCount >= 1) process.exit(0); // At least one merger report — allow.

// Check 2 (fallback): any TASK-*.json in ticketsDir with "status": "merged".
// Catches a merger that used a non-standard SendMessage format but did update
// the ticket JSON.
let ticketMergedCount = 0;
if (ctx.ticketsDir && existsSync(ctx.ticketsDir)) {
  let files = [];
  try {
    files = readdirSync(ctx.ticketsDir).filter((f) => /^TASK-.*\.json$/.test(f));
  } catch {
    files = [];
  }
  for (const f of files) {
    try {
      if (readFileSync(join(ctx.ticketsDir, f), "utf8").includes('"status": "merged"')) ticketMergedCount++;
    } catch {
      // unreadable — skip
    }
  }
}

if (ticketMergedCount >= 1) process.exit(0);

// Nothing found — block.
if (inboxExists) {
  blockWithReason(
    `The team-lead inbox at ${inboxPath} has 0 messages from the merger matching "merged TASK-..." or "...merge failed", and no TASK-*.json in ${ctx.ticketsDir} shows status=merged.`
  );
} else {
  blockWithReason(
    `The team-lead inbox at ${inboxPath} does not exist yet, and no TASK-*.json in ${ctx.ticketsDir} shows status=merged.`
  );
}
process.exit(2);
