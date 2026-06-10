#!/usr/bin/env node
// SubagentStart — for developer/simple-developer agents, create the per-session integration branch + _session worktree and the task worktree, then link node_modules. developer-TASK-XXX → <base>/<TASK_ID>; simple-developer → <base>/simple. Recovers from stale registrations, orphan dirs, and orphan branches.

import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHookContext } from "./lib/context.mjs";
import { getBaseBranch, git, getWorktreePaths } from "./lib/git.mjs";
import { getFirstTaskId } from "./lib/teams.mjs";
import {
  sessionBaseBranch,
  sessionBranch,
  sessionWorktreePath,
  simpleBranch,
  simpleWorktreePath,
  taskBranch,
  taskWorktreePath,
} from "./lib/topology.mjs";

const ctx = createHookContext(readFileSync(0, "utf8"), "setup-worktree");

const agentType = ctx.agentType || "";
const taskId = getFirstTaskId(agentType);

let worktreePath;
let branchName;
if (taskId) {
  worktreePath = taskWorktreePath(ctx, taskId);
  branchName = taskBranch(ctx, taskId);
} else if (agentType === "simple-developer") {
  worktreePath = simpleWorktreePath(ctx);
  branchName = simpleBranch(ctx);
} else {
  process.exit(0);
}

mkdirSync(ctx.sessionDir, { recursive: true });

const base = getBaseBranch();
const integrationBranch = sessionBranch(ctx);

const sessionWt = sessionWorktreePath(ctx);
if (
  git(["show-ref", "--verify", "--quiet", `refs/heads/${integrationBranch}`])
    .status !== 0
) {
  git(["branch", integrationBranch, base]);
  git(["branch", sessionBaseBranch(ctx), base]);
}

if (!existsSync(join(sessionWt, ".git"))) {
  rmSync(sessionWt, { recursive: true, force: true });
  mkdirSync(dirname(sessionWt), { recursive: true });
  git(["worktree", "prune"]);
  const add = git(["worktree", "add", sessionWt, integrationBranch]);
  if (add.status === 0) {
    ctx.linkNodeModules(sessionWt);
    ctx.log(
      `SESSION-BRANCH created ${integrationBranch} from ${base}`,
    );
  } else {
    ctx.log(
      `SESSION-BRANCH FAILED _session worktree ${integrationBranch} err=${add.stderr.replace(/\n/g, " ")}`,
    );
  }
}

ctx.log(
  `START agent=${agentType} path=${worktreePath} branch=${branchName}`,
);

if (getWorktreePaths().includes(worktreePath)) {
  ctx.accept(`already registered (${worktreePath})`);
}

if (existsSync(worktreePath)) {
  rmSync(worktreePath, { recursive: true, force: true });
  ctx.log(`REMOVED orphan dir ${worktreePath}`);
}

mkdirSync(dirname(worktreePath), { recursive: true });

if (git(["branch", "--list", branchName]).stdout.trim()) {
  git(["branch", "-D", branchName]);
  ctx.log(`DELETED orphan branch ${branchName}`);
}

const add = git([
  "worktree",
  "add",
  worktreePath,
  "-b",
  branchName,
  integrationBranch,
]);
if (add.status !== 0) {
  ctx.fail(
    `Cannot create worktree at ${worktreePath} (branch=${branchName}): ${add.stderr}\n`,
    {
      log: `path=${worktreePath} err=${add.stderr}`,
    },
  );
}
ctx.log(`CREATED branch=${branchName} path=${worktreePath}`);

ctx.linkNodeModules(worktreePath);
ctx.accept(`OK wt=${worktreePath}`);
