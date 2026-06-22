// Session worktree/branch topology — the single source for the layout created
// by setup-worktree and torn down by cleanup-worktree:
//   <worktreeBase>/TASK-XXX  on branch <short>/TASK-XXX   (one per ticket)
//   <worktreeBase>/ops       on branch <short>/ops        (single-shot rollback / migration)
//   <worktreeBase>/_session  on branch session/<short>    (merger integration)
//   session-base/<short>                                  (fixed fork anchor)
// Every hook that builds or matches these names must go through this module.

import { join } from "node:path";

export const taskWorktreePath = (ctx, taskId) => join(ctx.worktreeBase, taskId);
export const opsWorktreePath = (ctx) => join(ctx.worktreeBase, "ops");
export const sessionWorktreePath = (ctx) => join(ctx.worktreeBase, "_session");

export const taskBranch = (ctx, taskId) => `${ctx.sessionShort}/${taskId}`;
export const opsBranch = (ctx) => `${ctx.sessionShort}/ops`;
export const sessionBranch = (ctx) => `session/${ctx.sessionShort}`;
export const sessionBaseBranch = (ctx) => `session-base/${ctx.sessionShort}`;

// Infrastructure worktrees are never removed by cleanup.
export const isInfraWorktreePath = (p) => p.endsWith("/_session") || p.endsWith("/ops");
// Session-lifetime branches are never deleted by cleanup.
export const isProtectedBranch = (b) => /^session(-base)?\//.test(b) || /\/ops$/.test(b);
// Directory names under <worktreeBase> that the leftover sweep may touch.
export const isTaskWorktreeDirName = (name) => /^TASK-[0-9]+$/.test(name) || name === "ops";
