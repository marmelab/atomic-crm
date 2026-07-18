#!/usr/bin/env node
// PreToolUse(Bash): before `gh pr create` or `git push`, run the fast config
// checks (typecheck / lint validation steps) so a broken push is caught on the
// HUMAN path. Harness subagents are SKIPPED: they never push, and their
// SubagentStop chain already validates. exit 2 blocks the push/PR.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { loadConfig, prePrSteps } from "./lib/config.mjs";
import { REPO } from "./lib/paths.mjs";

const PR_TRIGGER_RE = /\bgh\s+pr\s+create\b|\bgit\s+push\b/;

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

// Human/main-thread only. A subagent carries an agent_type / runtime agent name.
if (input.agent_type || process.env.CLAUDE_AGENT_NAME) process.exit(0);

const command = input.tool_input?.command ?? "";
if (!PR_TRIGGER_RE.test(command)) process.exit(0);

let steps;
try {
  steps = prePrSteps(loadConfig());
} catch {
  process.exit(0); // no readable config -> do not block the human
}
if (!steps.length) process.exit(0);

const failures = [];
for (const step of steps) {
  if (!step.command) continue;
  try {
    execSync(step.command, { cwd: REPO, stdio: "pipe", timeout: 120_000 });
  } catch (err) {
    const out = (err.stdout?.toString() || err.message || "").slice(0, 800);
    failures.push(`- ${step.id} (\`${step.command}\`) failed:\n${out}`);
  }
}

if (failures.length) {
  console.error(
    `pre-pr-checks: push/PR blocked, ${failures.length} check(s) failed:\n\n` +
      failures.join("\n\n") +
      `\n\nFix the issues above, then retry.`,
  );
  process.exit(2);
}
process.exit(0);
