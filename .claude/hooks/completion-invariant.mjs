#!/usr/bin/env node
// SubagentStop(orchestrator) - completion invariant. INSURANCE for the handoff
// stall: forcing foreground dispatch is the real fix (foreground blocks, verified),
// but if the orchestrator ever stops with APPROVED dev work NOT merged into the session
// branch, that is an orphaned / incomplete pipeline. Reject the stop a few times (keep
// it alive to finish the merges FOREGROUND); if it still stops orphaned, drop a
// `needs-recovery` marker so the LAUNCHING SURFACE (main thread / chat-service, which IS
// re-invokable) re-runs <intent>recovery</intent>. Fail-open: any doubt or error accepts
// the stop, so this never wedges a legitimate completion.
//
// Second invariant, same spirit: stopping while <session_dir>/e2e-result.json says the
// end-of-feature suite FAILED. Reading that file is only a prompt-level instruction, so
// this is the deterministic backstop that a red suite cannot be swallowed in silence.
// One reject (own budget, no recovery marker), then the stop is allowed.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createHookContext } from "./lib/context.mjs";
import { readAgentMeta } from "./lib/agent-meta.mjs";
import { getUnmergedTaskBranches, git } from "./lib/git.mjs";
import { reviewFlag } from "./lib/reviews.mjs";
import { sessionBranch, simpleBranch } from "./lib/topology.mjs";

const REJECT_LIMIT = 2; // reject at most twice, then allow + mark for recovery
// A red e2e is not an orphaned pipeline, so it gets its own single-shot budget and no
// recovery marker: reject once to force the orchestrator to actually react to the result
// it was supposed to read, then let the stop through. Its own 2-round fix bound takes it
// from there, and "never wedge the pipeline" still holds.
const E2E_REJECT_LIMIT = 1;

let ctx;
try {
  const raw = readFileSync(0, "utf8");
  ctx = createHookContext(raw, "completion-invariant");
  const payload = JSON.parse(raw);

  // Only the orchestrator's stop is our concern. SubagentStop matchers do not reliably
  // filter (see cleanup-worktree) and agent_type in the payload is empty, so identify
  // via the sibling meta.json. Any doubt -> accept (never block a non-orchestrator stop).
  const meta = readAgentMeta(payload);
  if (!meta || meta.agentType !== "orchestrator") {
    ctx.accept(`not orchestrator (${meta?.agentType || "unknown"})`);
  }

  // No session branch yet -> nothing could be orphaned.
  const sessionRef = sessionBranch(ctx);
  if (
    git(["show-ref", "--verify", "--quiet", `refs/heads/${sessionRef}`])
      .status !== 0
  ) {
    ctx.accept("no session branch");
  }

  // Committed dev work not merged into the session branch. Reuse the promotion-safety
  // helper (single source of truth, fail-closed). Exclude <short>/simple (it promotes
  // straight to base, never into the session branch).
  const unmerged = getUnmergedTaskBranches(ctx.sessionShort, sessionRef, [
    simpleBranch(ctx),
  ]);

  // Only an APPROVED-but-unmerged branch is "orphaned by a stall". A branch with no
  // APPROVED review flag is a FAILED or still-in-review ticket, not our concern -
  // flagging it would be a false positive on every failed-ticket run.
  // Resolve the flag through reviews.mjs, the single source of truth shared with
  // block-merger-without-review: TICKETS_DIR == <session_dir>, so the flags live at
  // <session_dir>/reviews/. Hand-rolling it from ctx.ticketsDir looked in
  // <session_dir>/tickets/reviews/ (nothing sets TICKETS_DIR in a hook's env), a
  // directory that never exists, so this invariant silently never fired.
  const orphaned = unmerged
    .map((u) => u.branch)
    .filter((br) => {
      const taskId = br.split("/").pop(); // <short>/TASK-XXX -> TASK-XXX
      return existsSync(reviewFlag(ctx, taskId, "quality-reviewer"));
    });

  if (orphaned.length === 0) {
    clearRejects();
    rejectOnceOnRedE2e();
    ctx.accept("no approved-but-unmerged work");
  }

  const list = orphaned.join(", ");
  const rejects = readRejects();

  if (rejects < REJECT_LIMIT) {
    writeRejects(rejects + 1);
    ctx.fail(
      `Completion invariant: APPROVED work on [${list}] is NOT merged into ${sessionRef}. ` +
        `You are a nested subagent and are never re-invoked by a background child, so finish ` +
        `the pipeline NOW in this turn: dispatch the merger for these FOREGROUND ` +
        `(run_in_background:false). Do not end your turn. (attempt ${rejects + 1}/${REJECT_LIMIT})`,
      { log: `reject ${rejects + 1}/${REJECT_LIMIT} orphaned=[${list}]` },
    );
  }

  // Still orphaned after REJECT_LIMIT tries -> stop looping. Hand off to the launching
  // surface: write a recovery marker and allow the stop.
  writeRecoveryMarker(orphaned);
  clearRejects();
  ctx.accept(`needs-recovery written; orphaned=[${list}]`);
} catch (e) {
  // Fail-open: our own error must never wedge a stop.
  if (ctx) ctx.log(`error, accepting: ${String(e).slice(0, 140)}`);
  process.exit(0);
}

// --- red e2e ------------------------------------------------------------------
// The e2e verdict only exists in <session_dir>/e2e-result.json, written by
// e2e-on-feature-review.mjs. Reading it is a prompt-level instruction, so an
// orchestrator that never reads it would swallow a red suite in silence. Returns
// normally (caller accepts) unless it decided to reject this stop.
function rejectOnceOnRedE2e() {
  let result;
  try {
    const p = join(
      process.env.CHAT_SESSION_DIR || ctx.sessionDir,
      "e2e-result.json",
    );
    if (!existsSync(p)) return; // not run this round -> nothing to react to
    result = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return; // unreadable / malformed -> fail-open, same as the rest of this hook
  }
  if (result?.status !== "failed") return;

  // A session serves several requests. A red verdict from an earlier one describes a
  // commit that later merges have moved past, so it must not reject THIS request's
  // stop. An absent sha cannot be verified, so it still rejects: swallowing a real red
  // suite is the worse failure.
  const head = git(["rev-parse", sessionBranch(ctx)]);
  if (
    result.sessionSha &&
    head.status === 0 &&
    result.sessionSha !== head.stdout.trim()
  ) {
    ctx.log("red e2e predates the current session head, ignoring");
    return;
  }

  const rejects = readE2eRejects();
  if (rejects >= E2E_REJECT_LIMIT) {
    clearE2eRejects();
    ctx.log(`red e2e persists after ${rejects} reject(s), allowing the stop`);
    return;
  }
  writeE2eRejects(rejects + 1);
  ctx.fail(
    `Completion invariant: the end-of-feature e2e suite FAILED and you are stopping without ` +
      `acting on it. Read <session_dir>/e2e-result.json, then either fix it (ONE developer on ` +
      `<SESSION_SHORT_ID>/simple with the failing output as CHANGE_REQUEST, a STAGE: a-only ` +
      `merger, then re-run feature-review, which re-runs the suite) or, if you have already used ` +
      `the 2 fix rounds, state the failure explicitly in your final report. Do not end your turn ` +
      `leaving it unmentioned. (attempt ${rejects + 1}/${E2E_REJECT_LIMIT})`,
    { log: `reject ${rejects + 1}/${E2E_REJECT_LIMIT} red-e2e` },
  );
}

// --- markers -----------------------------------------------------------------
function breakerFile() {
  const dir = join(ctx.sessionDir, "breaker");
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    /* best effort */
  }
  return join(dir, "completion-invariant-rejects");
}
function readRejects() {
  try {
    return parseInt(readFileSync(breakerFile(), "utf8"), 10) || 0;
  } catch {
    return 0;
  }
}
function writeRejects(n) {
  try {
    writeFileSync(breakerFile(), String(n));
  } catch {
    /* best effort */
  }
}
function clearRejects() {
  try {
    unlinkSync(breakerFile());
  } catch {
    /* absent - fine */
  }
}
// Separate budget from the orphan one: a red e2e must not spend the merge-stall
// attempts, and a merge stall must not spend the e2e attempt.
function e2eBreakerFile() {
  const dir = join(ctx.sessionDir, "breaker");
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    /* best effort */
  }
  return join(dir, "completion-invariant-e2e-rejects");
}
function readE2eRejects() {
  try {
    return parseInt(readFileSync(e2eBreakerFile(), "utf8"), 10) || 0;
  } catch {
    return 0;
  }
}
function writeE2eRejects(n) {
  try {
    writeFileSync(e2eBreakerFile(), String(n));
  } catch {
    /* best effort */
  }
}
function clearE2eRejects() {
  try {
    unlinkSync(e2eBreakerFile());
  } catch {
    /* absent - fine */
  }
}
function writeRecoveryMarker(branches) {
  try {
    writeFileSync(
      join(ctx.sessionDir, "needs-recovery"),
      JSON.stringify({
        reason: "orphaned-task-branches",
        branches,
        at: new Date().toISOString(),
      }) + "\n",
    );
  } catch {
    /* best effort */
  }
}
