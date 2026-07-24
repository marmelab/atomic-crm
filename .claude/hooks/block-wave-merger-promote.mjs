#!/usr/bin/env node
// PreToolUse(Bash): a Stage-A-only merger (a per-ticket wave merge, or any
// dispatch carrying STAGE: a-only) must NEVER run Stage B: promoting the session
// branch into the base branch. Runtime enforcement of merger.md ("TASK-XXX ->
// Stage A only; promotion runs once at the end via a separate MODE: promote dispatch").
//
// Root cause it closes (forensic, session 7ba88e76): a wave merger dispatched as
// `TASK_ID: TASK-001` (no MODE, no STAGE) ran `git checkout -f <base>` +
// `git merge --no-ff session/<short> -m "merge(session)"`, promoting partial wave-1
// work onto the base branch. The merger never checks the persona, so this is
// mode-agnostic: in a NORMAL run it would corrupt the real base branch (or main)
// mid-flow. A technical-only guard would merely mask it, so the guard is universal.
//
// Authorization is recorded at dispatch by record-merger-stage.mjs into
// <sessionDir>/merger-stage.json. Fails CLOSED: a missing/unreadable marker blocks
// the promotion: the running merger cannot prove it is authorized.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHookContext } from "./lib/context.mjs";
import { isMerger } from "./lib/teams.mjs";
import { sessionBranch } from "./lib/topology.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "block-wave-merger-promote");

// Only the merger runs Stage B; every other agent is out of scope for this guard.
if (![ctx.agentName, ctx.agentType].some(isMerger)) process.exit(0);

const cmd = input.tool_input?.command || "";
if (!cmd) process.exit(0);

// Stage-B signature: a `git merge` that pulls in the session branch (promotion),
// or the promotion commit message. Stage A merges a <short>/TASK-XXX branch INTO
// the session branch and never names session/<short> as a merge argument, so it
// does not match.
const session = sessionBranch(ctx); // session/<short>
const isStageBPromotion =
  /\bgit\s+merge\b/.test(cmd) &&
  (cmd.includes(session) || /merge\(session\)/.test(cmd));
if (!isStageBPromotion) process.exit(0);

// Read the dispatch-time authorization marker. Fail CLOSED.
let promote = false;
let markerSeen = false;
try {
  const marker = JSON.parse(
    readFileSync(join(ctx.sessionDir, "merger-stage.json"), "utf8"),
  );
  markerSeen = true;
  promote = marker.promote === true;
} catch {
  promote = false; // no/unreadable marker -> not authorized
}

if (promote) process.exit(0);

ctx.fail(
  "Blocked: this merger is a Stage-A-only dispatch and must NOT promote the session branch to the base branch.\n\n" +
    `It tried to run Stage B (promotion):\n  ${cmd}\n\n` +
    (markerSeen
      ? "Its dispatch is not authorized to promote (a per-ticket TASK-XXX wave merge, or STAGE: a-only)."
      : "No promotion-authorization marker was found for this session (fail-closed).") +
    "\n\nStage B runs ONLY via a dedicated `MODE: promote` merger after the LAST wave, or a SIMPLE / MIGRATION single-shot. " +
    `A per-ticket wave merger runs Stage A ONLY: merge <short>/TASK-XXX into ${session} and stop. ` +
    'See merger.md ("TASK-XXX -> Stage A only") and orchestrator.md\'s promotion block.',
  { log: `BLOCK stage-A merger tried Stage B (markerSeen=${markerSeen})` },
);
