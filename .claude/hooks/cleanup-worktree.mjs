#!/usr/bin/env node
// SubagentStop — remove this session's task worktrees once their branch has been
// merged (--no-ff, the merger's contract) into the session integration branch and
// the worktree has no uncommitted changes. Session worktrees/branches (_session,
// simple, session*/), fresh worktrees, and unmerged work are preserved.

import { existsSync, readdirSync, readFileSync, rmSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { createHookContext } from "./lib/context.mjs";
import {
  getBaseBranch,
  getWorktreeEntries,
  getWorktreePaths,
  git,
} from "./lib/git.mjs";
import { exec } from "./lib/process.mjs";
import {
  isInfraWorktreePath,
  isProtectedBranch,
  isTaskWorktreeDirName,
  sessionBaseBranch,
  sessionBranch,
} from "./lib/topology.mjs";

const ctx = createHookContext(readFileSync(0, "utf8"), "cleanup-worktree");

if (!existsSync(ctx.worktreeBase)) {
  ctx.accept(`${ctx.worktreeBase} not found`);
}

const base = getBaseBranch();
ctx.log(
  `START session=${ctx.sessionShort} base=${ctx.worktreeBase} branch=${base}`,
);

const isUnderBase = (p) =>
  p === ctx.worktreeBase || p.startsWith(ctx.worktreeBase + "/");

const hasLocalBranch = (ref) =>
  git(["show-ref", "--verify", "--quiet", `refs/heads/${ref}`]).status === 0;

// Tips that were merged with --no-ff into the session integration branch: the
// second-plus parents of its merge commits. Ancestry alone cannot tell a merged
// branch from a fresh one that never diverged (both tips are ancestors), and a
// fresh worktree may belong to a developer still working — so only branches
// whose tip is a recorded merge parent are removable.
const getMergedTips = () => {
  const integration = sessionBranch(ctx);
  if (!hasLocalBranch(integration)) return new Set();
  const anchor = sessionBaseBranch(ctx);
  const range = hasLocalBranch(anchor)
    ? `${anchor}..${integration}`
    : integration;
  return new Set(
    git(["log", "--merges", "--format=%P", range])
      .stdout.split("\n")
      .filter(Boolean)
      .flatMap((line) => line.split(" ").slice(1)),
  );
};
const mergedTips = getMergedTips();

const shouldRemove = ({ path: wtPath, branch }) => {
  if (isInfraWorktreePath(wtPath)) {
    ctx.log(`SKIP-SESSION-WORKTREE ${wtPath}`);
    return false;
  }
  if (!branch) {
    ctx.log(`SKIP-DETACHED ${wtPath} (detached HEAD)`);
    return false;
  }
  const tip = git(["rev-parse", "--verify", branch]).stdout.trim();
  if (!tip || !mergedTips.has(tip)) {
    ctx.log(`SKIP-UNMERGED ${wtPath} branch=${branch}`);
    return false;
  }
  if (exec("git", ["-C", wtPath, "status", "--porcelain"]).stdout.trim()) {
    ctx.log(`SKIP-DIRTY ${wtPath} (uncommitted changes)`);
    return false;
  }
  return true;
};

const removeWorktree = (wtPath) => {
  if (git(["worktree", "remove", "--force", wtPath]).status === 0) {
    ctx.log(`REMOVED ${wtPath}`);
    return;
  }
  rmSync(wtPath, { recursive: true, force: true });
  ctx.log(`RM-RF ${wtPath}`);
};

const deleteBranch = (branch) => {
  if (!branch) return;
  if (isProtectedBranch(branch)) {
    ctx.log(`SKIP-SESSION-BRANCH ${branch}`);
    return;
  }
  if (git(["branch", "-d", branch]).status !== 0) {
    git(["branch", "-D", branch]);
  }
  ctx.log(`BRANCH-DELETED ${branch}`);
};

const ourWorktrees = getWorktreeEntries().filter((e) => isUnderBase(e.path));
const toRemove = ourWorktrees.filter(shouldRemove);

toRemove.forEach((e) => removeWorktree(e.path));
toRemove.map((e) => e.branch).forEach(deleteBranch);

git(["worktree", "prune"]);

const registered = getWorktreePaths();

const sweepLeftover = (entry) => {
  if (!entry.isDirectory()) return;
  const dir = join(ctx.worktreeBase, entry.name);
  if (dir.endsWith("/_session")) {
    ctx.log(`SKIP-SESSION-LEFTOVER ${dir}`);
    return;
  }
  if (!isTaskWorktreeDirName(entry.name)) {
    ctx.log(`SKIP-NON-WORKTREE ${dir}`);
    return;
  }
  if (registered.includes(dir)) return;
  rmSync(dir, { recursive: true, force: true });
  ctx.log(`LEFTOVER RM ${dir}`);
};

readdirSync(ctx.worktreeBase, { withFileTypes: true }).forEach(sweepLeftover);

try {
  rmdirSync(ctx.worktreeBase);
} catch {
  // not empty / already gone — fine
}

ctx.accept(
  `removed=${toRemove.length} skipped=${ourWorktrees.length - toRemove.length} session=${ctx.sessionShort}`,
);
