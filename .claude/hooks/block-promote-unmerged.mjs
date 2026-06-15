#!/usr/bin/env node
// PreToolUse(Agent) — block the session->main promotion while any developed-but-
// unmerged task branch still exists. In the no-team flow the orchestrator tracks
// each wave's tickets in its own context across many background turns; a ticket
// that finishes early can be lost between its developer's DONE and the
// REVIEW->MERGE transition — its branch never merges into session/<short>, yet
// the orchestrator believes the wave is done and dispatches the promotion merger,
// silently dropping the work. This is the deterministic backstop.
//
// Behavioural counterpart: chat-orchestrator STATE B Step 3 reconciles against
// disk before promoting, so in the normal case this never fires.

import { readFileSync } from "node:fs";
import { createHookContext } from "./lib/context.mjs";
import { parseDispatch } from "./lib/dispatch-parse.mjs";
import { git } from "./lib/git.mjs";
import { sessionBranch } from "./lib/topology.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "block-promote-unmerged");
const d = parseDispatch(input);

// Only gate the promotion-merger dispatch.
if (d.subagentType !== "merger" || d.mode !== "promote") process.exit(0);

const short = ctx.sessionShort;
const session = sessionBranch(ctx);

// No session branch yet → nothing to guard.
if (
  git(["show-ref", "--verify", "--quiet", `refs/heads/${session}`]).status !== 0
) {
  process.exit(0);
}

// Every task branch lives under refs/heads/<short>/ (e.g. <short>/TASK-001,
// <short>/simple). session/<short> and session-base/<short> have a different
// prefix and are not matched.
const branches = git([
  "for-each-ref",
  "--format=%(refname:short)",
  `refs/heads/${short}`,
])
  .stdout.split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

const unmerged = [];
for (const br of branches) {
  const n = git(["rev-list", "--count", `${session}..${br}`]).stdout.trim();
  if (Number(n) > 0) unmerged.push(`${br} (${n} unmerged commit(s))`);
}

if (unmerged.length === 0) process.exit(0);

ctx.fail(
  `Refusing to promote ${session} to main — these task branches have commits NOT yet merged into the session branch:\n` +
    unmerged.map((u) => `  - ${u}`).join("\n") +
    "\n" +
    "A ticket was developed but never merged (its reviewers/merger were likely never dispatched). For EACH branch above, drive its ticket through REVIEW -> MERGE (dispatch its quality-reviewer + test-validator if needed, then its per-ticket merger) so its work lands on the session branch. Re-dispatch the promotion merger only once this list is empty.",
  { log: `BLOCK unmerged=${unmerged.length}` },
);
