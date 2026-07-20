#!/usr/bin/env node
// PreToolUse(Bash) - per-subagent circuit breaker. Counts Bash calls per subagent
// (keyed on agent_id, present only for subagents) and blocks once a subagent
// exceeds the loop limit, so a stuck agent can't spin forever. The main session
// (no agent_id) is never throttled - interactive sessions legitimately make many
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

// Per-subagent budget of WORK calls. Read-only exploration and git plumbing/commit
// are free (see isFreeCommand), so this counts only "real work" (builds, scripts,
// migrations, rebases). 45 work calls is comfortable and catches infinite loops
// (which hit 100+ fast). Before this exclusion, devs burned the whole budget on
// grep-based symbol search (0 LSP / 209 grep in one session) and had none left to
// commit.
const ITERATION_LIMIT = 45;

// A Bash call is "free" (never counted) when its primary command is read-only
// exploration or git plumbing/commit. Strips a leading `cd <path> &&` (the worktree
// convention) and inspects the first token of the first pipeline stage.
function isFreeCommand(raw) {
  let c = String(raw || "").trim();
  c = c.replace(/^cd\s+\S+\s*(?:&&|;)\s*/, "").trim();
  const first = c.split(/[|&;]/)[0].trim().split(/\s+/)[0] || "";
  const READONLY = new Set([
    "grep",
    "rg",
    "egrep",
    "fgrep",
    "find",
    "ls",
    "cat",
    "wc",
    "head",
    "tail",
    "pwd",
    "tree",
    "stat",
    "file",
    "which",
    "echo",
    "dirname",
    "basename",
    "realpath",
  ]);
  if (READONLY.has(first)) return true;
  const gm = c.match(/^git\s+(\S+)/);
  if (gm) {
    const GIT_FREE = new Set([
      "add",
      "commit",
      "status",
      "diff",
      "log",
      "show",
      "branch",
      "rev-parse",
      "rev-list",
      "stash",
      "worktree",
      "ls-files",
      "merge-base",
    ]);
    if (GIT_FREE.has(gm[1])) return true;
  }
  return false;
}

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "circuit-breaker");

// Per-subagent breaker only. The main session (no agent_id) is never throttled.
if (!ctx.agentId) process.exit(0);

// Read-only exploration (grep/find/ls/cat/...) and git plumbing (add/commit/status)
// do NOT count against the budget. The breaker exists to catch stuck WORK loops, not
// to ration symbol search or starve the final commit.
if (isFreeCommand(input.tool_input?.command)) {
  ctx.log(`free: ${String(input.tool_input?.command ?? "").slice(0, 80)}`);
  process.exit(0);
}

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
    reason: `Circuit breaker: this subagent has made ${count} Bash calls - likely stuck in a loop. Stop, and report where you are blocked so the orchestrator can re-dispatch with a fresh context.`,
    log: `BLOCK count=${count}`,
  });
}

process.exit(0);
