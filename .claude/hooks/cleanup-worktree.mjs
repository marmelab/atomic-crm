#!/usr/bin/env node
// SubagentStop hook — removes session worktrees after the merger completes.
// Only acts on worktrees under this session's worktreeBase.
//
// Guard: only removes worktrees whose branch has been merged into the repo's
// base branch AND has commits. If the merger stopped prematurely (before
// merging), the worktree is preserved.

import { existsSync, readdirSync, rmSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { readStdin, crmIdentity, baseBranch, git, exec } from "./lib/common.mjs";

const ctx = crmIdentity(readStdin());

if (!existsSync(ctx.worktreeBase)) {
  ctx.log(`cleanup-worktree SKIP ${ctx.worktreeBase} not found`);
  process.exit(0);
}

const base = baseBranch();
ctx.log(`cleanup-worktree START session=${ctx.sessionShort} base=${ctx.worktreeBase} branch=${base}`);

let removed = 0;
let skipped = 0;
const branchesToDelete = [];

// Parse `git worktree list --porcelain` into { path, branch } entries.
// Format: a "worktree <path>" line, optional "branch refs/heads/<name>" line
// (absent when detached), then a blank line separating entries.
const porcelain = git(["worktree", "list", "--porcelain"]).stdout;
const entries = [];
let cur = null;
for (const line of porcelain.split("\n")) {
  if (line.startsWith("worktree ")) {
    cur = { path: line.slice("worktree ".length), branch: "" };
    entries.push(cur);
  } else if (line.startsWith("branch refs/heads/") && cur) {
    cur.branch = line.slice("branch refs/heads/".length);
  }
}

for (const { path: wtPath, branch } of entries) {
  if (!(wtPath === ctx.worktreeBase || wtPath.startsWith(ctx.worktreeBase + "/"))) continue;

  // Never clean the session integration worktree or the SIMPLE worktree; both
  // persist for the whole session (_session for complex merges, <ID>/simple for
  // the optional POST-DEV migration round).
  if (wtPath.endsWith("/_session") || wtPath.endsWith("/simple")) {
    ctx.log(`cleanup-worktree SKIP-SESSION-WORKTREE ${wtPath}`);
    skipped++;
    continue;
  }

  // Only remove if the branch has developer commits AND is merged into base:
  // - A detached HEAD has no branch name to check.
  // - A freshly created branch (no commits) has HEAD == base, so --merged would
  //   flag it merged; check for commits first to avoid removing a just-started one.
  // - An unmerged branch with commits must be preserved until the merger runs.
  if (!branch) {
    ctx.log(`cleanup-worktree SKIP-DETACHED ${wtPath} (detached HEAD)`);
    skipped++;
    continue;
  }
  const ahead = git(["log", "--oneline", `${base}..${branch}`]).stdout.split("\n")[0] || "";
  if (!ahead.trim()) {
    ctx.log(`cleanup-worktree SKIP-NO-COMMITS ${wtPath} branch=${branch}`);
    skipped++;
    continue;
  }
  const mergedOut = git(["branch", "--merged", base]).stdout;
  const isMerged = mergedOut.split("\n").some((l) => l.includes(` ${branch}`));
  if (!isMerged) {
    ctx.log(`cleanup-worktree SKIP-UNMERGED ${wtPath} branch=${branch}`);
    skipped++;
    continue;
  }

  branchesToDelete.push(branch);
  if (git(["worktree", "remove", "--force", wtPath]).status === 0) {
    ctx.log(`cleanup-worktree REMOVED ${wtPath}`);
  } else {
    rmSync(wtPath, { recursive: true, force: true });
    ctx.log(`cleanup-worktree RM-RF ${wtPath}`);
  }
  removed++;
}

for (const branch of branchesToDelete) {
  if (!branch) continue;
  // Never delete session branches, the anchor ref, or the SIMPLE branch — they
  // must persist for the whole session (*/simple may be reused by POST-DEV migration).
  if (/^session\//.test(branch) || /^session-base\//.test(branch) || /\/simple$/.test(branch)) {
    ctx.log(`cleanup-worktree SKIP-SESSION-BRANCH ${branch}`);
    continue;
  }
  if (git(["branch", "-d", branch]).status !== 0) {
    git(["branch", "-D", branch]);
  }
  ctx.log(`cleanup-worktree BRANCH-DELETED ${branch}`);
}

git(["worktree", "prune"]);

// Remove leftover dirs not registered as git worktrees.
const registered = git(["worktree", "list", "--porcelain"])
  .stdout.split("\n")
  .filter((l) => l.startsWith("worktree "))
  .map((l) => l.slice("worktree ".length));

for (const entry of readdirSync(ctx.worktreeBase, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = join(ctx.worktreeBase, entry.name);
  // Never remove the session integration worktree; it persists for the whole session.
  if (dir.endsWith("/_session")) {
    ctx.log(`cleanup-worktree SKIP-SESSION-LEFTOVER ${dir}`);
    continue;
  }
  // Only sweep orphaned *worktree* directories (named TASK-XXX or "simple"). In
  // the portable path layout `worktreeBase` IS `sessionDir`, so sibling session
  // state dirs (tickets, flags, breaker) and the hooks log live here too — they
  // are NOT worktrees and must never be deleted by this sweep. (In the original
  // chat-service layout these lived under /chat-service/logs, outside the base.)
  const isWorktreeDir = /^TASK-[0-9]+$/.test(entry.name) || entry.name === "simple";
  if (!isWorktreeDir) {
    ctx.log(`cleanup-worktree SKIP-NON-WORKTREE ${dir}`);
    continue;
  }
  if (!registered.includes(dir)) {
    rmSync(dir, { recursive: true, force: true });
    ctx.log(`cleanup-worktree LEFTOVER RM ${dir}`);
  }
}

try {
  rmdirSync(ctx.worktreeBase); // only succeeds if now empty
} catch {
  // not empty / already gone — fine
}

ctx.log(`cleanup-worktree EXIT=0 removed=${removed} skipped=${skipped} session=${ctx.sessionShort}`);
process.exit(0);
