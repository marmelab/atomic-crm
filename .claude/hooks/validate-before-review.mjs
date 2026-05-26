#!/usr/bin/env node
// PreToolUse hook for SendMessage tool.
// When the developer is about to SendMessage a reviewer or the merger, run the
// project validation chain. If any step fails, exit 2 to block the SendMessage;
// the dev sees the stderr as a tool_use_error.
//
// Why gate reviewers AND merger:
// - If validation fails, the dev must fix and commit again — and the reviewers
//   must re-evaluate the new commit. So reviewers only ever see validated commits.
// - The per-worktree SHA cache makes validating before every reviewer message
//   essentially free on unchanged HEADs (the "dev messages reviewer-A then
//   reviewer-B" pair runs the chain once, then hits the cache).
//
// Behavior:
// - Skips for non-reviewer/non-merger recipients.
// - Per-worktree SHA cache: a previous success on the same HEAD short-circuits.
// - Otherwise runs (in order): typecheck, prettier, unit-app, unit-functions, e2e.
// - First failure → exit 2 with the failing script's stderr passed through.
//
// DRY RUN MODE: VALIDATE_DRY_RUN=1 → sub-scripts skipped, exit 0.
//               VALIDATE_DRY_RUN=fail → simulates a failure, exit 2.

import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { readStdin, parseJson, crmIdentity, sanitizePath, exec, bash, git } from "./lib/common.mjs";

const stdin = readStdin();
const input = parseJson(stdin);
const ctx = crmIdentity(input);
const { flagsDir, worktreeBase, sessionId } = ctx;

try {
  mkdirSync(flagsDir, { recursive: true });
} catch {
  // best-effort
}

const touch = (p) => {
  try {
    writeFileSync(p, "");
  } catch {
    // best-effort
  }
};

// On exit, emit an EXIT=N log line. When the exit is a block (code 2) AND we
// reached actual validation (logWt set), also write a fail-cache so sibling
// SendMessages for the same SHA fail instantly instead of re-running the chain.
// (This mirrors the bash `trap … EXIT`.)
let logWt = "";
function finish(code) {
  ctx.log(`validate-before-review EXIT=${code} wt=${logWt}`);
  if (code === 2 && logWt) {
    const sha = exec("git", ["-C", logWt, "rev-parse", "HEAD"]).stdout.trim();
    if (sha) {
      try {
        writeFileSync(join(flagsDir, `cache-${sanitizePath(logWt)}.bad.sha`), sha);
      } catch {
        // best-effort
      }
    }
  }
  process.exit(code);
}

if (!stdin) finish(0);

// (A) Only gate when a developer agent is the caller. The orchestrator also
// sends to merger (bare name) — without this check, its shutdown batch and
// merge-forward messages get fully validated, wasting ~60s each.
const agentName = process.env.CLAUDE_AGENT_NAME || "";
const agentType = input.agent_type || "";
const recv = input.tool_input?.to || "";
ctx.log(`validate-before-review INVOKE agent_env='${agentName}' agent_type='${agentType}' to='${recv}'`);

const callerIsDeveloper =
  /^developer-/.test(agentName) || agentType === "developer" || /^developer-/.test(agentType);
if (!callerIsDeveloper) finish(0);

const to = input.tool_input?.to || "";

// Gate only for reviewer / validator / merger recipients.
const gated =
  /^quality-reviewer[-@]/.test(to) || /^test-validator[-@]/.test(to) || /^merger[-@]/.test(to) || to === "merger";
if (!gated) finish(0);

// (B) Skip validation for shutdown_request messages — teardown carries no diff.
const message = input.tool_input?.message;
const msgBody = typeof message === "string" ? message : message != null ? JSON.stringify(message) : "";
if (msgBody.includes("shutdown_request")) finish(0);

// Derive the caller's worktree so chained scripts validate only that one.
// Source of truth: TASK-XXX suffix on the recipient name, else in the message.
let taskId = (to.match(/TASK-[0-9]+/) || [])[0] || "";
if (!taskId) taskId = (msgBody.match(/TASK-[0-9]+/) || [])[0] || "";

let validateWorktree = "";
let flagQr;
let flagTv;
let flagMerger;
if (taskId) {
  validateWorktree = join(worktreeBase, taskId);
  process.env.VALIDATE_WORKTREE = validateWorktree; // exported for the sub-scripts
  flagQr = join(flagsDir, `notified-qr-${taskId}`);
  flagTv = join(flagsDir, `notified-tv-${taskId}`);
  flagMerger = join(flagsDir, `notified-merger-${taskId}`);
}
logWt = validateWorktree;

// (F) Enforce that the developer notifies BOTH reviewers before reaching merger.
if (taskId && (to === "merger" || /^merger-/.test(to))) {
  let missing = "";
  if (!existsSync(flagQr)) missing += `quality-reviewer-${taskId} `;
  if (!existsSync(flagTv)) missing += `test-validator-${taskId} `;
  if (missing) {
    process.stderr.write(
      `[validate-before-review] Blocked: cannot message merger for ${taskId} before notifying all reviewers. Missing: ${missing}\n`
    );
    process.stderr.write(
      `Send "ready, please review" to both quality-reviewer-${taskId} AND test-validator-${taskId} first.\n`
    );
    finish(2);
  }
  // Both reviewer flags exist → the full chain already ran and passed when the
  // developer first notified the reviewers. Skip re-running it for the merger.
  ctx.log(`validate-before-review COMPLEX-SKIP to=merger ${taskId} (both reviewer flags present)`);
  touch(flagMerger);
  finish(0);
}

ctx.log(`validate-before-review START to=${to} wt=${validateWorktree}`);

// Active worktrees under this session's base.
const activeWorktrees = git(["worktree", "list", "--porcelain"])
  .stdout.split("\n")
  .filter((l) => l.startsWith("worktree "))
  .map((l) => l.slice("worktree ".length))
  .filter((p) => p.startsWith(worktreeBase + "/"));

// (C) Scope the SHA cache to the specific worktree when set, else all active.
const cacheWorktrees = validateWorktree ? [validateWorktree] : activeWorktrees;

const headOf = (wt) => exec("git", ["-C", wt, "rev-parse", "HEAD"]).stdout.trim();
const readSha = (file) => {
  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    return "";
  }
};

// SHA cache: skip the chain if HEAD of every cache worktree matches the SHA we
// last validated successfully. Invalidated by every new commit.
if (cacheWorktrees.length > 0) {
  let allCached = true;
  for (const wt of cacheWorktrees) {
    const head = headOf(wt);
    if (!head || head !== readSha(join(flagsDir, `cache-${sanitizePath(wt)}.sha`))) {
      allCached = false;
      break;
    }
  }
  if (allCached) {
    ctx.log(`validate-before-review CACHE HIT to=${to} (worktree at last-validated SHA)`);
    if (taskId) {
      if (/^quality-reviewer-/.test(to)) touch(flagQr);
      else if (/^test-validator-/.test(to)) touch(flagTv);
      else if (to === "merger" || /^merger-/.test(to)) touch(flagMerger);
    }
    finish(0);
  }
}

// Fail cache: if the current HEAD already failed a previous run on the same SHA,
// fail instantly instead of re-running the full chain (handles the dev messaging
// both reviewers simultaneously on the same broken commit).
if (cacheWorktrees.length > 0) {
  let allFailed = true;
  for (const wt of cacheWorktrees) {
    const head = headOf(wt);
    if (!head || head !== readSha(join(flagsDir, `cache-${sanitizePath(wt)}.bad.sha`))) {
      allFailed = false;
      break;
    }
  }
  if (allFailed) {
    ctx.log(`validate-before-review FAIL-CACHE HIT to=${to} (SHA already failed)`);
    process.stderr.write(
      "This commit already failed validation. Fix the issue and make a new commit before messaging the reviewer.\n"
    );
    finish(2);
  }
}

// Dry-run hooks (test-only).
if (process.env.VALIDATE_DRY_RUN === "1") {
  process.stderr.write(`VALIDATE_WORKTREE=${validateWorktree || "<all>"}\n`);
  ctx.log("validate-before-review DRY_RUN=1, skipping checks, exit 0");
  finish(0);
} else if (process.env.VALIDATE_DRY_RUN === "fail") {
  ctx.log("validate-before-review DRY_RUN=fail, exit 2");
  process.stderr.write("Validation failed (simulated).\n");
  finish(2);
}

// Auto-apply prettier before the validation chain. If prettier --write fails
// (e.g. a syntax error), exit early with the actual error.
if (validateWorktree && existsSync(validateWorktree)) {
  const pretty = bash("npx prettier --write 'src/**/*.{ts,tsx,js,jsx,css,json,html}' 2>&1", { cwd: validateWorktree });
  if (pretty.status !== 0) {
    ctx.log(`validate-before-review auto-prettier FAILED exit=${pretty.status} wt=${validateWorktree}`);
    process.stderr.write(
      "Prettier could not format one or more files (likely a syntax error). Fix the issue and commit before sending to reviewer.\n"
    );
    process.stderr.write(pretty.stdout + "\n");
    finish(2);
  }
  if (exec("git", ["-C", validateWorktree, "diff", "--quiet"]).status !== 0) {
    exec("git", ["-C", validateWorktree, "add", "-A"]);
    exec("git", ["-C", validateWorktree, "commit", "-m", `style(${taskId}): auto-apply prettier`]);
    ctx.log(`validate-before-review auto-prettier wt=${validateWorktree} committed`);
  }
}

// Ordered list: cheapest checks first to fail fast.
const scripts = [
  "typecheck-on-commit.mjs",
  "prettier-on-stop.mjs",
  "run-unit-tests-app.mjs",
  "run-unit-tests-functions.mjs",
  "run-e2e-tests.mjs",
];
// Pipe a SubagentStop-like stdin so the sub-scripts don't error on empty input.
const emptyStdin = JSON.stringify({
  hook_event_name: "PreToolUse_SendMessage",
  matcher: "SendMessage",
  session_id: sessionId,
});

for (const script of scripts) {
  const full = join(import.meta.dirname, script);
  if (!existsSync(full)) {
    ctx.log(`validate-before-review WARN ${script} missing, skipping`);
    continue;
  }
  const r = exec("node", [full], { input: emptyStdin });
  if (r.status === 0) {
    ctx.log(`validate-before-review ${script} OK`);
  } else {
    ctx.log(`validate-before-review ${script} FAILED exit=${r.status}`);
    process.stderr.write((r.stdout || "") + (r.stderr || ""));
    finish(2);
  }
}

ctx.log(`validate-before-review ALL OK to=${to}`);

// Cache the SHA(s) we just validated so subsequent SendMessages on the same
// commit short-circuit. Also clear the fail cache so a future fix+commit isn't
// blocked by a stale bad-SHA entry.
for (const wt of cacheWorktrees) {
  const head = headOf(wt);
  if (head) {
    try {
      writeFileSync(join(flagsDir, `cache-${sanitizePath(wt)}.sha`), head);
    } catch {
      // best-effort
    }
    try {
      unlinkSync(join(flagsDir, `cache-${sanitizePath(wt)}.bad.sha`));
    } catch {
      // best-effort
    }
  }
}

// (F) Record that this reviewer/validator/merger was successfully notified.
// member-idle-gate reads these flags to unblock each agent type.
if (taskId) {
  if (/^quality-reviewer-/.test(to)) touch(flagQr);
  else if (/^test-validator-/.test(to)) touch(flagTv);
  else if (to === "merger" || /^merger-/.test(to)) touch(flagMerger);
}

finish(0);
