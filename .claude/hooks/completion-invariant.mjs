#!/usr/bin/env node
// SubagentStop(orchestrator) - completion invariant. INSURANCE for the handoff
// stall: forcing foreground dispatch is the real fix (foreground blocks, verified),
// but if the orchestrator ever stops with APPROVED dev work NOT merged into the session
// branch, that is an orphaned / incomplete pipeline. Reject the stop a few times (keep
// it alive to finish the merges FOREGROUND); if it still stops orphaned, drop a
// `needs-recovery` marker so the LAUNCHING SURFACE (main thread / chat-service, which IS
// re-invokable) re-runs <intent>recovery</intent>. Fail-open: any doubt or error accepts
// the stop, so this never wedges a legitimate completion.

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
import { sessionBranch, simpleBranch } from "./lib/topology.mjs";

const REJECT_LIMIT = 2; // reject at most twice, then allow + mark for recovery

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
  const orphaned = unmerged
    .map((u) => u.branch)
    .filter((br) => {
      const taskId = br.split("/").pop(); // <short>/TASK-XXX -> TASK-XXX
      return existsSync(
        join(ctx.ticketsDir, "reviews", `${taskId}-quality-reviewer`),
      );
    });

  if (orphaned.length === 0) {
    clearRejects();
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
