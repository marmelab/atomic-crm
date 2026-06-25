#!/usr/bin/env node
// PreToolUse(Agent) — at most ONE `planner` dispatch per request.
//
// Scope = one request, not one session and not one orchestrator lifetime:
//   key = caller orchestrator agent_id + TICKETS_DIR.
// - Developer session: the main thread dispatches a fresh orchestrator (new
//   agent_id) per request, so the key never collides across requests.
// - chat-orchestrator (one long-lived instance, many requests): TICKETS_DIR is
//   per-request, so each genuine new request gets a new key and its own planner.
// Same orchestrator + same TICKETS_DIR = same planning round → the 2nd planner
// is blocked. A 1-hour staleness reset prevents a stuck marker from poisoning a
// long-lived orchestrator.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createHookContext } from "./lib/context.mjs";
import { parseDispatch } from "./lib/dispatch-parse.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "block-duplicate-planner");
const d = parseDispatch(input);

// Only gate planner dispatches.
if (d.subagentType !== "planner") process.exit(0);

// Scope the marker to (caller orchestrator, TICKETS_DIR) = one planning round.
// Without a caller agent_id we can't scope safely — allow rather than over-block.
const caller = ctx.agentId;
if (!caller) process.exit(0);
// The STATE A planner template writes `TICKETS_DIR=<path>` (equals); parseDispatch
// only captures the `TICKETS_DIR:` (colon) form, so read it here accepting both.
const prompt = String(input.tool_input?.prompt ?? "");
const promptTicketsDir =
  (prompt.match(/^TICKETS_DIR[:=]\s*(\S+)/m) || [])[1] || "";
const ticketsDir = d.ticketsDir || promptTicketsDir || ctx.ticketsDir || "";
const keyHash = createHash("sha1")
  .update(`${caller}::${ticketsDir}`)
  .digest("hex")
  .slice(0, 16);

const markerDir = join(ctx.sessionDir, "breaker");
try {
  mkdirSync(markerDir, { recursive: true });
} catch {
  process.exit(0); // can't persist a marker → don't risk blocking the only planner
}
const marker = join(markerDir, `planner-${keyHash}`);

// Auto-reset a stale marker (>1h) so a long-lived orchestrator isn't poisoned.
if (existsSync(marker)) {
  try {
    if (Date.now() - statSync(marker).mtimeMs > 60 * 60 * 1000)
      unlinkSync(marker);
  } catch {
    // ignore — fall through to the existence check
  }
}

if (existsSync(marker)) {
  ctx.block({
    reason:
      `A \`planner\` has ALREADY been dispatched for this request (TICKETS_DIR=${ticketsDir || "(session default)"}). ` +
      `Do NOT dispatch a second planner — a re-plan overwrites the existing TASK-*.json while the wave may already be running against them. ` +
      `Read the tickets already in TICKETS_DIR and continue into STATE B with them. ` +
      `If the first plan looks wrong, fix the ticket JSON in place — do not re-run the planner.`,
    log: `BLOCK 2nd planner caller=${caller} ticketsDir=${ticketsDir || "(default)"}`,
  });
}

try {
  writeFileSync(marker, `${caller} ${ticketsDir}\n`);
} catch {
  // if we can't record the marker, still allow this (first) planner through
}
ctx.log(
  `ALLOW 1st planner caller=${caller} ticketsDir=${ticketsDir || "(default)"}`,
);
process.exit(0);
