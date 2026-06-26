#!/usr/bin/env node
// PreToolUse(Agent) — block accidental duplicate dispatches. Two concerns,
// grouped in one hook because both are "don't dispatch the same thing twice":
//
//  1. planner: at most ONE `planner` dispatch per request.
//     Scope = caller orchestrator agent_id + TICKETS_DIR (one planning round).
//     A 2nd planner would overwrite the TASK-*.json the wave is already running
//     against.
//
//  2. developer / quality-reviewer / merger: debounce identical re-dispatches
//     inside a short window. A foreground Agent call is SUPPOSED to block and
//     return the subagent's final line inline; in some runtimes (interactive
//     Claude Code) it instead returns immediately with "Async agent launched …
//     agentId: <id>" and the real result arrives later as a task-notification.

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

const DEBOUNCE_ROLES = new Set(["developer", "quality-reviewer", "merger"]);
const DEBOUNCE_WINDOW_MS = 90 * 1000;
const PLANNER_STALE_MS = 60 * 60 * 1000;

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "block-duplicate-dispatch");
const d = parseDispatch(input);
const prompt = String(input.tool_input?.prompt ?? "");

// Without a caller agent_id we can't scope a marker safely — allow rather than
// risk over-blocking the only dispatch.
const caller = ctx.agentId;
if (!caller) process.exit(0);

const markerDir = join(ctx.sessionDir, "breaker");
try {
  mkdirSync(markerDir, { recursive: true });
} catch {
  process.exit(0); // can't persist a marker → don't risk blocking a real dispatch
}

const sha = (s) => createHash("sha1").update(s).digest("hex").slice(0, 16);

// ---- Concern 1: at most one planner per request -------------------------------
if (d.subagentType === "planner") {
  // The STATE A planner template writes `TICKETS_DIR=<path>` (equals);
  // parseDispatch only captures the `TICKETS_DIR:` (colon) form, so accept both.
  const promptTicketsDir =
    (prompt.match(/^TICKETS_DIR[:=]\s*(\S+)/m) || [])[1] || "";
  const ticketsDir = d.ticketsDir || promptTicketsDir || ctx.ticketsDir || "";
  const marker = join(markerDir, `planner-${sha(`${caller}::${ticketsDir}`)}`);

  if (existsSync(marker)) {
    try {
      // Stale if older than the window — OR if its mtime is in the FUTURE
      // (clock skew / NFS drift): a negative age would otherwise read as "fresh"
      // forever and permanently block re-planning, with no escape (the
      // orchestrator can't rm a breaker marker — bash-guard blocks that).
      const age = Date.now() - statSync(marker).mtimeMs;
      if (age > PLANNER_STALE_MS || age < 0) unlinkSync(marker);
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
}

// ---- Concern 2: debounce duplicate developer/reviewer/merger dispatches -------
if (DEBOUNCE_ROLES.has(d.subagentType)) {
  // Key on the ticket identity AND the prompt content. The async-ack duplicate
  // re-issues the IDENTICAL dispatch prompt, so an identical (caller, role,
  // ticket, prompt) inside the window collides and is blocked. A genuine retry
  // carries different prompt text (RETRY_FEEDBACK / FIX findings) → different
  // key → allowed even inside the window (keying on the TASK id alone would
  // wrongly debounce a fast-failing ticket's legitimate re-dispatch). The
  // TASK id, when present, is kept as the human-readable label for messages.
  const label = d.taskId || `prompt:${sha(prompt)}`;
  const idPart = `${d.taskId || "_"}::${sha(prompt)}`;
  const marker = join(
    markerDir,
    `dispatch-${sha(`${caller}::${d.subagentType}::${idPart}`)}`,
  );

  if (existsSync(marker)) {
    let ageMs = Infinity;
    try {
      ageMs = Date.now() - statSync(marker).mtimeMs;
    } catch {
      // unreadable mtime → treat as stale, fall through to refresh + allow
    }
    if (ageMs < DEBOUNCE_WINDOW_MS) {
      ctx.block({
        reason:
          `A \`${d.subagentType}\` dispatch for ${label} was made ${Math.round(ageMs / 1000)}s ago and is still in flight. ` +
          `A dispatch can return immediately as "Async agent launched … agentId: <id>" WITHOUT blocking — that acknowledgement means "dispatched", not "done". ` +
          `Do NOT re-dispatch the same role for the same ticket: wait for its task-notification, then read the agent's output file and parse its contract line. ` +
          `Two ${d.subagentType}s on the same ticket race on one worktree/branch — that is always a bug.`,
        log: `BLOCK duplicate ${d.subagentType} key=${idPart} age=${Math.round(ageMs / 1000)}s caller=${caller}`,
      });
    }
  }
  try {
    writeFileSync(marker, `${caller} ${d.subagentType} ${idPart}\n`);
  } catch {
    // can't record → allow this dispatch through
  }
  ctx.log(`ALLOW ${d.subagentType} dispatch key=${idPart} caller=${caller}`);
  process.exit(0);
}

process.exit(0);
