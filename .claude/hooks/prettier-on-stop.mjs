#!/usr/bin/env node
// SubagentStop hook — prettier check in any active worktree with changes.
// Exit 2 on failure → stderr injected, subagent stays alive to run prettier:apply.

import { existsSync } from "node:fs";
import {
  readStdin,
  crmIdentity,
  baseBranch,
  activeWorktrees,
  worktreeDirty,
  tailLines,
  bash,
} from "./lib/common.mjs";

const ctx = crmIdentity(readStdin());
ctx.log(`prettier START REPO=${ctx.repo}`);

if (!existsSync(ctx.repo)) {
  ctx.log("prettier EXIT=0 cd_failed");
  process.exit(0);
}

// Only check ACTIVE feature worktrees under this session's worktreeBase. See
// typecheck hook for the rationale (skip main repo — pre-existing state is not
// our concern). VALIDATE_WORKTREE narrows to one worktree.
const worktrees = activeWorktrees(ctx);
if (worktrees.length === 0) {
  ctx.log("prettier EXIT=0 no_active_worktree");
  process.exit(0);
}

const base = baseBranch();
let failed = false;
let aggregatedErr = "";

for (const wt of worktrees) {
  if (!worktreeDirty(wt, base)) {
    ctx.log(`prettier SKIP wt=${wt} (no changes)`);
    continue;
  }

  // Scope to src/ only — avoids false positives on docs/ files created by the
  // planner (e.g. project-context.json) that the developer didn't touch.
  const result = bash("npx prettier --check 'src/**/*.{ts,tsx,js,jsx,css,json,html}' 2>&1", { cwd: wt });
  if (result.status !== 0) {
    failed = true;
    aggregatedErr += `=== prettier failed in ${wt} ===\n${tailLines(result.stdout, 15)}\n\n`;
    ctx.log(`prettier FAIL wt=${wt} EXIT=${result.status}`);
  } else {
    ctx.log(`prettier OK wt=${wt}`);
  }
}

if (failed) {
  process.stderr.write("Prettier check failed — run 'npm run prettier:apply' in the worktree(s) below:\n");
  process.stderr.write(aggregatedErr);
  ctx.log("prettier EXIT=2");
  process.exit(2);
}

ctx.log("prettier EXIT=0 OK (all worktrees)");
process.exit(0);
