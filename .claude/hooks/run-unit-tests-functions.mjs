#!/usr/bin/env node
// SubagentStop hook — unit tests (functions) in each active worktree with changes.
// Exit 2 on failure → stderr injected, subagent stays alive.

import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  readStdin,
  crmIdentity,
  baseBranch,
  activeWorktrees,
  worktreeDirty,
  worktreeChangedFiles,
  runVitest,
} from "./lib/common.mjs";

const ctx = crmIdentity(readStdin());
ctx.log(`unit-fn START REPO=${ctx.repo}`);

if (!existsSync(ctx.repo)) {
  ctx.log("unit-fn EXIT=0 cd_failed");
  process.exit(0);
}

// Functions test suite is optional: skip cleanly when the project has no
// Edge Functions (the supabase/functions/ dir may have been removed). The tests
// themselves live in the "functions" project of vitest.config.ts.
if (!existsSync(join(ctx.repo, "supabase", "functions"))) {
  ctx.log("unit-fn EXIT=0 no_functions_dir");
  process.exit(0);
}

// VALIDATE_WORKTREE narrows to one worktree (set by validate-before-review).
const worktrees = activeWorktrees(ctx);
if (worktrees.length === 0) {
  ctx.log("unit-fn EXIT=0 no_active_worktree");
  process.exit(0);
}

const base = baseBranch();
let failed = false;
let aggregatedErr = "";

for (const wt of worktrees) {
  if (!worktreeDirty(wt, base)) {
    ctx.log(`unit-fn SKIP wt=${wt} (no changes)`);
    continue;
  }

  // Skip ADR-only diffs (.md docs, no test impact).
  const changed = worktreeChangedFiles(wt, base);
  if (changed.length > 0 && changed.every((f) => f.startsWith("adr/"))) {
    ctx.log(`unit-fn SKIP wt=${wt} (adr-only)`);
    continue;
  }

  const { status, output, timedOut } = runVitest(wt, "vitest.config.ts", [
    "functions",
  ]);
  if (timedOut) {
    ctx.log(`unit-fn TIMEOUT wt=${wt} (180s)`);
    failed = true;
    aggregatedErr += `=== unit-fn TIMEOUT in ${wt} (>180s) -- vitest did not exit. Tests may be hanging. ===\n\n`;
    continue;
  }
  if (status !== 0) {
    failed = true;
    aggregatedErr += `=== unit-fn failed in ${wt} ===\n${output}\n\n`;
    ctx.log(`unit-fn FAIL wt=${wt} EXIT=${status}`);
  } else {
    ctx.log(`unit-fn OK wt=${wt}`);
  }
}

if (failed) {
  process.stderr.write(aggregatedErr);
  ctx.log("unit-fn EXIT=2");
  process.exit(2);
}

ctx.log("unit-fn EXIT=0 OK (all worktrees)");
process.exit(0);
