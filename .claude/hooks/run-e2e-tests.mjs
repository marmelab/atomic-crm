#!/usr/bin/env node
// SubagentStop hook — e2e tests.
// Exit 2 on failure → stderr injected, subagent stays alive.

import { existsSync } from "node:fs";
import { readStdin, crmIdentity, tailLines, bash } from "./lib/common.mjs";

const ctx = crmIdentity(readStdin());
const mode = process.env.MODE || "demo";
ctx.log(`e2e START MODE=${mode} REPO=${ctx.repo}`);

if (!existsSync(ctx.repo)) {
  ctx.log("e2e EXIT=0 cd_failed");
  process.exit(0);
}

if (mode === "demo") {
  ctx.log("e2e EXIT=0 skipped_demo");
  process.exit(0);
}

const result = bash("npx playwright test 2>&1", { cwd: ctx.repo });
if (result.status !== 0) {
  process.stderr.write(tailLines(result.stdout, 50) + "\n");
  ctx.log(`e2e EXIT=2 playwright_exit=${result.status}`);
  process.exit(2);
}

ctx.log("e2e EXIT=0 OK");
process.exit(0);
