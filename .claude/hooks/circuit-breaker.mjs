#!/usr/bin/env node
// PreToolUse hook — per-subagent circuit breaker.
// Detects agents stuck in Bash loops without sabotaging legitimate multi-agent
// workflows that cumulatively exceed a session-wide budget.
//
// Keyed on `agent_id` (unique per subagent dispatch). Verified empirically in
// Claude Code 2.1.x: the hook input JSON includes `agent_id` ONLY when the
// calling context is a subagent — absent for the top-level orchestrator.
// So each subagent gets its own budget, and a loop in one doesn't block others.
//
// Input on stdin: { session_id, transcript_path, agent_id?, agent_type?,
//                   tool_name, tool_input, ... }

import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { readStdin, parseJson, crmIdentity, tmpRoot, decisionBlock } from "./lib/common.mjs";

// Per-subagent Bash budget. Calibrated on the "hooks own validation" model:
// developer doesn't run typecheck/prettier/vitest/e2e himself (those are
// run by SubagentStop hooks and blocked at PreToolUse via
// block-bash-validation.mjs). So a dev's legitimate Bash usage is:
//   worktree setup (1) + git add/commit/status (5-8) + git exploration (2-3)
//   + fix retries (5-10) = ~15-20 Bash calls per ticket.
// 45 is comfortable for this workload and catches infinite loops (which
// typically hit 100+ in a few seconds).
const ITERATION_LIMIT = 45;

const input = parseJson(readStdin());
const ctx = crmIdentity(input);

// Per-subagent breaker only. The main session (no agent_id) is never throttled —
// an interactive session legitimately makes many Bash calls.
if (!ctx.agentId) process.exit(0);

const key = `sub-${ctx.agentId}`;
const keyHash = createHash("sha1").update(key).digest("hex").slice(0, 16);

let counterDir = join(ctx.sessionDir, "breaker");
try {
  mkdirSync(counterDir, { recursive: true });
} catch {
  counterDir = tmpRoot();
}
const counterFile = join(counterDir, `bash-count-${keyHash}`);

// Auto-reset if counter file is older than 1 hour (stale subagent).
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

// Observability: record the keyed count so we can audit per-agent budgets.
ctx.log(`circuit-breaker key=${key} hash=${keyHash} count=${count}`);

if (count > ITERATION_LIMIT) {
  decisionBlock(
    `Circuit breaker: this subagent has made ${count} Bash calls — likely stuck in a loop. Stop, report where you are blocked so the orchestrator can re-dispatch with a fresh context.`
  );
}

process.exit(0);
