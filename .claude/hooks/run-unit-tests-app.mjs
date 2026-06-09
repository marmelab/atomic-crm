#!/usr/bin/env node
// SubagentStop hook — unit tests (app) in each active worktree with changes.
// Exit 2 on failure → stderr injected, subagent stays alive.

import { existsSync } from "node:fs";
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
ctx.log(`unit-app START REPO=${ctx.repo}`);

if (!existsSync(ctx.repo)) {
  ctx.log("unit-app EXIT=0 cd_failed");
  process.exit(0);
}

// VALIDATE_WORKTREE narrows to one worktree (set by validate-before-review).
// See typecheck hook header for rationale.
const worktrees = activeWorktrees(ctx);
if (worktrees.length === 0) {
  ctx.log("unit-app EXIT=0 no_active_worktree");
  process.exit(0);
}

const base = baseBranch();
let failed = false;
let aggregatedErr = "";

for (const wt of worktrees) {
  if (!worktreeDirty(wt, base)) {
    ctx.log(`unit-app SKIP wt=${wt} (no changes)`);
    continue;
  }

  // Skip ADR-only diffs (.md docs, no test impact).
  const changed = worktreeChangedFiles(wt, base);
  if (changed.length > 0 && changed.every((f) => f.startsWith("adr/"))) {
    ctx.log(`unit-app SKIP wt=${wt} (adr-only)`);
    continue;
  }

  // Call vitest directly with the `run` subcommand (not `npm run test:unit:app`)
  // because the package.json script invokes `vitest --config …` without `run`,
  // which puts vitest into watch mode. In a non-TTY agent context, watch mode
  // hangs at startup instead of running tests once and exiting.
  // Scope to the browser ("app") and harness ("claude") projects; the Deno-style
  // "functions" project is handled by run-unit-tests-functions.mjs.
  const { status, output, timedOut } = runVitest(wt, "vitest.config.ts", [
    "app",
    "claude",
  ]);
  if (timedOut) {
    ctx.log(`unit-app TIMEOUT wt=${wt} (180s)`);
    failed = true;
    aggregatedErr += `=== unit-app TIMEOUT in ${wt} (>180s) -- vitest did not exit. Tests may be hanging. ===\n\n`;
    continue;
  }
  if (status !== 0) {
    failed = true;
    aggregatedErr += `=== unit-app failed in ${wt} ===\n${output}\n\n`;
    ctx.log(`unit-app FAIL wt=${wt} EXIT=${status}`);
  } else {
    ctx.log(`unit-app OK wt=${wt}`);
  }
}

if (failed) {
  process.stderr.write(aggregatedErr);
  ctx.log("unit-app EXIT=2");
  process.exit(2);
}

ctx.log("unit-app EXIT=0 OK (all worktrees)");
process.exit(0);
