// Per-ticket review verdict flags. The presence of a flag means that reviewer
// returned APPROVED for the ticket. Written by record-review-verdict.mjs
// (SubagentStop), read by block-merger-without-review.mjs (PreToolUse/Agent),
// cleared on REJECTED and when a developer is (re)dispatched (setup-worktree.mjs)
// so a changed diff invalidates stale approvals. Session-scoped under
// <sessionDir>/reviews, mirroring the <sessionDir>/flags convention.

import { join } from "node:path";

export const REVIEW_ROLES = ["quality-reviewer", "test-validator"];

export const reviewsDir = (ctx) => join(ctx.sessionDir, "reviews");

export const reviewFlag = (ctx, taskId, role) =>
  join(reviewsDir(ctx), `${taskId}-${role}`);
