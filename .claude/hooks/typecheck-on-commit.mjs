#!/usr/bin/env node
// SubagentStop hook — runs typecheck on each active worktree with changes.
// Exit 2 on failure → stderr injected as error, subagent stays alive to fix.

import { existsSync } from "node:fs";
import {
  readStdin,
  crmIdentity,
  baseBranch,
  activeWorktrees,
  worktreeDirty,
  worktreeChangedFiles,
  tailLines,
  bash,
} from "./lib/common.mjs";

const ctx = crmIdentity(readStdin());
ctx.log(`typecheck START REPO=${ctx.repo} MODE=${process.env.MODE || ""}`);

if (!existsSync(ctx.repo)) {
  ctx.log("typecheck EXIT=0 cd_failed");
  process.exit(0);
}

// Only check ACTIVE feature worktrees under this session's worktreeBase. The
// main repo is the merge target — pre-existing state there is not the current
// subagent's concern. Running typecheck on the repo with orphan untracked files
// from previous sessions caused a regression where a developer deviated from its
// task to "fix" unrelated typecheck errors.
//
// VALIDATE_WORKTREE: when set by validate-before-review, restrict to that single
// worktree. Avoids the "shared brakes" issue where one dev's broken state blocks
// all parallel SendMessages (one bad TASK poisoning N reviewers).
const worktrees = activeWorktrees(ctx);
if (worktrees.length === 0) {
  ctx.log("typecheck EXIT=0 no_active_worktree");
  process.exit(0);
}

const base = baseBranch();
let failed = false;
let aggregatedErr = "";

for (const wt of worktrees) {
  if (!worktreeDirty(wt, base)) {
    ctx.log(`typecheck SKIP wt=${wt} (no changes)`);
    continue;
  }

  // Skip if every changed path is under adr/. ADRs are .md docs and don't
  // affect typecheck; running it on a doc-only commit wastes ~10-20s per ADR.
  const changed = worktreeChangedFiles(wt, base);
  if (changed.length > 0 && changed.every((f) => f.startsWith("adr/"))) {
    ctx.log(`typecheck SKIP wt=${wt} (adr-only)`);
    continue;
  }

  const result = bash("npm run typecheck 2>&1", { cwd: wt });
  if (result.status !== 0) {
    failed = true;
    aggregatedErr += `=== typecheck failed in ${wt} ===\n${tailLines(result.stdout, 20)}\n\n`;
    ctx.log(`typecheck FAIL wt=${wt} EXIT=${result.status}`);
  } else {
    ctx.log(`typecheck OK wt=${wt}`);
  }
}

if (failed) {
  process.stderr.write("Typecheck failed — fix TypeScript errors before completing:\n");
  process.stderr.write(aggregatedErr);
  ctx.log("typecheck EXIT=2");
  process.exit(2);
}

ctx.log("typecheck EXIT=0 OK (all worktrees)");
process.exit(0);
