#!/usr/bin/env node
// PreToolUse(Bash) — per-subagent circuit breaker. Counts Bash calls per subagent
// (keyed on agent_id, present only for subagents) and blocks once a subagent
// exceeds the loop limit, so a stuck agent can't spin forever. The main session
// (no agent_id) is never throttled — interactive sessions legitimately make many
// Bash calls.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createHookContext } from "./lib/context.mjs";
import { TMP_ROOT } from "./lib/paths.mjs";

// Per-subagent Bash budget. A developer's legitimate Bash usage is worktree setup
// + git add/commit/status + exploration + fix retries (~15-20 calls). 45 is
// comfortable for that workload and catches infinite loops (which hit 100+ fast).
const ITERATION_LIMIT = 45;

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "circuit-breaker");

// Per-subagent breaker only. The main session (no agent_id) is never throttled.
if (!ctx.agentId) process.exit(0);

const key = `sub-${ctx.agentId}`;
const keyHash = createHash("sha1").update(key).digest("hex").slice(0, 16);

let counterDir = join(ctx.sessionDir, "breaker");
try {
  mkdirSync(counterDir, { recursive: true });
} catch {
  counterDir = TMP_ROOT;
}
const counterFile = join(counterDir, `bash-count-${keyHash}`);

// Auto-reset if the counter file is older than 1 hour (stale subagent).
if (existsSync(counterFile)) {
  try {
    const ageMs = Date.now() - statSync(counterFile).mtimeMs;
    if (ageMs > 60 * 60 * 1000) unlinkSync(counterFile);
  } catch {
    // ignore
  }
}

let count = 0;
try {
  count = parseInt(readFileSync(counterFile, "utf8"), 10) || 0;
} catch {
  count = 0;
}
count += 1;
try {
  writeFileSync(counterFile, String(count));
} catch {
  // ignore
}

// Observability: record the keyed count so per-agent budgets can be audited.
ctx.log(`key=${key} hash=${keyHash} count=${count}`);

if (count > ITERATION_LIMIT) {
  ctx.block({
    reason: `Circuit breaker: this subagent has made ${count} Bash calls — likely stuck in a loop. Stop, and report where you are blocked so the orchestrator can re-dispatch with a fresh context.`,
    log: `BLOCK count=${count}`,
  });
}

process.exit(0);
