#!/usr/bin/env node
// SubagentStop — full validation chain (prettier auto-fix, typecheck, unit app/functions, e2e) on active worktrees with changes; exit 2 keeps the subagent alive to fix and commit. VALIDATE_DRY_RUN=1 skips the chain; =fail simulates a failure.

import { readFileSync } from "node:fs";
import { createHookContext } from "./lib/context.mjs";
import { runValidationSteps } from "./lib/validation.mjs";

const ctx = createHookContext(readFileSync(0, "utf8"), "validate");
ctx.log(`START REPO=${ctx.repo} MODE=${process.env.MODE || ""}`);

const result = runValidationSteps(ctx);

if (!result.ok) {
  ctx.fail(
    `Validation failed at step '${result.step}' — fix the errors and commit before completing:\n` +
      result.output,
    { log: `step=${result.step}` },
  );
}

ctx.accept(result.skipReason || "OK (all worktrees)");
