// Session worktree/branch topology — the single source for the layout created
// by setup-worktree and torn down by cleanup-worktree:
//   <worktreeBase>/TASK-XXX  on branch <short>/TASK-XXX   (one per ticket)
//   <worktreeBase>/simple    on branch <short>/simple     (SIMPLE flow / migration)
//   <worktreeBase>/_session  on branch session/<short>    (merger integration)
//   session-base/<short>                                  (fixed fork anchor)
// Every hook that builds or matches these names must go through this module.

import { join } from "node:path";

export const taskWorktreePath = (ctx, taskId) => join(ctx.worktreeBase, taskId);
export const simpleWorktreePath = (ctx) => join(ctx.worktreeBase, "simple");
export const sessionWorktreePath = (ctx) => join(ctx.worktreeBase, "_session");

export const taskBranch = (ctx, taskId) => `${ctx.sessionShort}/${taskId}`;
export const simpleBranch = (ctx) => `${ctx.sessionShort}/simple`;
export const sessionBranch = (ctx) => `session/${ctx.sessionShort}`;
export const sessionBaseBranch = (ctx) => `session-base/${ctx.sessionShort}`;

// Infrastructure worktrees are never removed by cleanup.
export const isInfraWorktreePath = (p) => p.endsWith("/_session") || p.endsWith("/simple");
// Session-lifetime branches are never deleted by cleanup.
export const isProtectedBranch = (b) => /^session(-base)?\//.test(b) || /\/simple$/.test(b);
// Directory names under <worktreeBase> that the leftover sweep may touch.
export const isTaskWorktreeDirName = (name) => /^TASK-[0-9]+$/.test(name) || name === "simple";
