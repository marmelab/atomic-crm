#!/usr/bin/env node
// PreToolUse(Agent) — block dispatching a per-ticket merger until BOTH reviewers
// (quality-reviewer + test-validator) have recorded APPROVED for that ticket.
// With no SendMessage handshake, nothing else stops the orchestrator from going
// developer -> merger directly and skipping review; this gate enforces the
// dev -> reviewers -> (both APPROVED) -> merger ordering structurally.
//
// Verdicts are recorded by record-review-verdict.mjs (SubagentStop) as flags
// under <sessionDir>/reviews/<TASK>-<role>. Skipped for the SIMPLE flow,
// promotion-only, and rollback dispatches (no per-ticket review), and when the
// ticket can't be identified (fail open, never wedge the flow).

import { existsSync, readFileSync } from "node:fs";
import { createHookContext } from "./lib/context.mjs";
import { parseDispatch } from "./lib/dispatch-parse.mjs";
import { REVIEW_ROLES, reviewFlag } from "./lib/reviews.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "block-merger-without-review");
const d = parseDispatch(input);

if (d.subagentType !== "merger") process.exit(0); // only gate merger dispatches
if (d.mode === "promote") process.exit(0); // promotion-only carries no per-ticket review
if (["SIMPLE", "PROMOTE", "ROLLBACK"].includes(d.taskId)) process.exit(0);
if (!/^TASK-\d+$/.test(d.taskId)) process.exit(0); // can't identify a ticket → fail open

const missing = REVIEW_ROLES.filter(
  (role) => !existsSync(reviewFlag(ctx, d.taskId, role)),
);
if (missing.length === 0) process.exit(0); // both APPROVED → allow the merge

ctx.fail(
  `Refusing to dispatch the merger for ${d.taskId}: no APPROVED verdict from ${missing.join(" and ")} yet.\n` +
    "The flow is: developer -> quality-reviewer + test-validator -> (BOTH return APPROVED) -> merger.\n" +
    `Dispatch quality-reviewer-${d.taskId} and test-validator-${d.taskId} first (STATE B transitions), then dispatch the merger only after both APPROVED.`,
  { log: `BLOCK ${d.taskId} missing=${missing.join(",")}` },
);
