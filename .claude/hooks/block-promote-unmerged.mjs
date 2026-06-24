#!/usr/bin/env node
// PreToolUse(Agent) — block the session->main promotion while any developed-but-
// unmerged task branch still exists. In the no-team flow the orchestrator tracks
// each wave's tickets in its working context across a long synchronous turn; a
// ticket can be lost between its developer's DONE and the REVIEW->MERGE
// transition — its branch never merges into session/<short>, yet the orchestrator
// believes the wave is done and dispatches the promotion merger, silently
// dropping the work. This is the deterministic backstop.
//
// Behavioural counterpart: chat-orchestrator STATE B's Promotion step reconciles
// against disk before promoting, so in the normal case this never fires.

import { readFileSync } from "node:fs";
import { createHookContext } from "./lib/context.mjs";
import { parseDispatch } from "./lib/dispatch-parse.mjs";
import { getUnmergedTaskBranches, git } from "./lib/git.mjs";
import { simpleBranch, sessionBranch } from "./lib/topology.mjs";

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

// Task branches under refs/heads/<short>/ with commits not on the session branch.
// <short>/simple is excluded: the single-shot rollback/migration round promotes it
// straight to main, never into the session branch, so it is legitimately "ahead"
// of session/<short> and must not block a wave promotion. Fails CLOSED — a
// branch whose rev-list count can't be read is reported as unmerged.
const unmerged = getUnmergedTaskBranches(short, session, [simpleBranch(ctx)]);

if (unmerged.length === 0) process.exit(0);

const describe = ({ branch, count }) =>
  `  - ${branch} (${count === null ? "unmerged (count unavailable)" : `${count} unmerged commit(s)`})`;

ctx.fail(
  `Refusing to promote ${session} to the base branch — these task branches have commits NOT yet merged into the session branch:\n` +
    unmerged.map(describe).join("\n") +
    "\n" +
    "A ticket was developed but never merged (its reviewer/merger were likely never dispatched). For EACH branch above, drive its ticket through REVIEW -> MERGE (dispatch its quality-reviewer if needed, then its per-ticket merger) so its work lands on the session branch. Re-dispatch the promotion merger only once this list is empty.",
  { log: `BLOCK unmerged=${unmerged.length}` },
);
