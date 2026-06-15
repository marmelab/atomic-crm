#!/usr/bin/env node
// PreToolUse(SendMessage) — block any shutdown_request until the merger has reported a merge result (a team-lead inbox message, or a TASK-*.json with status=merged). Prevents collapsing Phase 1 and Phase 3.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { stringifyMessage } from "./lib/io.mjs";
import { createHookContext } from "./lib/context.mjs";
import { getTeamConfigsForSession, isValidTeamName } from "./lib/teams.mjs";
import { TEAMS_DIR } from "./lib/paths.mjs";

const isMergeReport = (text) =>
  /(^|\s)merged\s+TASK-/.test(text) || /merge\s+failed/.test(text);
const isTicketFile = (name) => /^TASK-.*\.json$/.test(name);

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "block-premature-shutdowns");

const ti = input.tool_input || {};
const tool = input.tool_name || "";
const to = ti.to || "";
const msg = stringifyMessage(ti.message);
const sessionId = input.session_id || "";

if (tool !== "SendMessage") process.exit(0);

if (!msg.includes("shutdown_request")) process.exit(0);

let team = ti.team_name || "";
if (!isValidTeamName(team)) {
  team = "";
  if (
    ctx.sessionShort &&
    existsSync(join(TEAMS_DIR, `tickets-${ctx.sessionShort}`))
  ) {
    team = `tickets-${ctx.sessionShort}`;
  }
  if (!team && sessionId && existsSync(TEAMS_DIR)) {
    const cfg = getTeamConfigsForSession(sessionId)[0];
    if (cfg) team = basename(dirname(cfg));
  }
}

if (!team) process.exit(0);

const inboxPath = join(TEAMS_DIR, team, "inboxes", "team-lead.json");
const inboxExists = existsSync(inboxPath);

const blockWithReason = (reason) =>
  ctx.fail(
    `Blocked: SendMessage(to: "${to}", shutdown_request)
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
`,
  );

const hasMergerReport = () => {
  if (!inboxExists) return false;
  const inbox = JSON.parse(readFileSync(inboxPath, "utf8")) || [];
  return (Array.isArray(inbox) ? inbox : []).some(
    (entry) =>
      (entry.from || "") === "merger" &&
      isMergeReport((entry.text || entry.message || "").toString()),
  );
};

if (hasMergerReport()) process.exit(0);

const hasMergedTicket = () => {
  if (!ctx.ticketsDir || !existsSync(ctx.ticketsDir)) return false;
  let files = [];
  try {
    files = readdirSync(ctx.ticketsDir).filter(isTicketFile);
  } catch {
    return false;
  }
  return files.some((f) => {
    try {
      return readFileSync(join(ctx.ticketsDir, f), "utf8").includes(
        '"status": "merged"',
      );
    } catch {
      return false;
    }
  });
};

if (hasMergedTicket()) process.exit(0);

if (inboxExists) {
  blockWithReason(
    `The team-lead inbox at ${inboxPath} has 0 messages from the merger matching "merged TASK-..." or "...merge failed", and no TASK-*.json in ${ctx.ticketsDir} shows status=merged.`,
  );
} else {
  blockWithReason(
    `The team-lead inbox at ${inboxPath} does not exist yet, and no TASK-*.json in ${ctx.ticketsDir} shows status=merged.`,
  );
}
