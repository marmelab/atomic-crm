#!/usr/bin/env node
// SubagentStop — full validation chain (prettier auto-fix, typecheck, unit app/functions, e2e) on active worktrees with changes; exit 2 keeps the subagent alive to fix and commit. VALIDATE_DRY_RUN=1 skips the chain; =fail simulates a failure.

import { readFileSync } from "node:fs";
import { createHookContext } from "./lib/context.mjs";
import { git } from "./lib/git.mjs";
import { getFirstTaskId } from "./lib/teams.mjs";
import {
  sessionBranch,
  simpleWorktreePath,
  taskWorktreePath,
} from "./lib/topology.mjs";
import { runValidationSteps } from "./lib/validation.mjs";

const ctx = createHookContext(readFileSync(0, "utf8"), "validate");

// Scope validation to the stopping subagent's OWN worktree: developer-TASK-XXX
// validates <base>/TASK-XXX, simple-developer validates <base>/simple. Avoids the
// "shared brakes" failure where one ticket's broken state blocks an unrelated
// developer and N stops each re-validate every session worktree. Falls back to
// all session worktrees when the identity can't be resolved.
const ids = [ctx.agentName, ctx.agentType].filter(Boolean);
const taskId = ids.map(getFirstTaskId).find(Boolean) || "";
const ownWorktree = taskId
  ? taskWorktreePath(ctx, taskId)
  : ids.some((n) => /simple-developer/.test(n))
    ? simpleWorktreePath(ctx)
    : "";

// Diff each worktree against the branch it forked from (session/<short>), not the
// repo's checked-out base branch, so validation sees the ticket's OWN change set.
// Empty base → validation.mjs falls back to the repo base branch (e.g. before the
// session branch exists).
const sessionRef = sessionBranch(ctx);
const base =
  git(["show-ref", "--verify", "--quiet", `refs/heads/${sessionRef}`])
    .status === 0
    ? sessionRef
    : "";

ctx.log(
  `START REPO=${ctx.repo} MODE=${process.env.MODE || ""} wt=${ownWorktree || "all"} base=${base || "repo-default"}`,
);

const result = runValidationSteps(ctx, { worktree: ownWorktree, base });

if (!result.ok) {
  ctx.fail(
    `Validation failed at step '${result.step}' — fix the errors and commit before completing:\n` +
      result.output,
    { log: `step=${result.step}` },
  );
}

ctx.accept(result.skipReason || `OK (${ownWorktree || "all worktrees"})`);
