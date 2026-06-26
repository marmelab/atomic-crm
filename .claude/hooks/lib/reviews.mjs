// Per-ticket review verdict flags. The presence of a flag means that reviewer
// returned APPROVED for the ticket. PRIMARY writer is the quality-reviewer agent
// itself — it touches the flag via Bash as its last action before emitting the
// contract line (see quality-reviewer.md), so the verdict is recorded
// synchronously and never depends on a post-stop transcript read. FALLBACK writer
// is record-review-verdict.mjs (SubagentStop), kept as belt-and-suspenders for the
// case the reviewer forgot the touch. Read by block-merger-without-review.mjs
// (PreToolUse/Agent), cleared on REJECTED and when a developer is (re)dispatched
// (setup-worktree.mjs) so a changed diff invalidates stale approvals. Session-scoped
// under <sessionDir>/reviews, mirroring the <sessionDir>/flags convention.

import { join } from "node:path";

export const REVIEW_ROLES = ["quality-reviewer"];

export const reviewsDir = (ctx) => join(ctx.sessionDir, "reviews");

export const reviewFlag = (ctx, taskId, role) =>
  join(reviewsDir(ctx), `${taskId}-${role}`);
