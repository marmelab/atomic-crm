#!/usr/bin/env node
// PreToolUse(SendMessage) — when a developer messages a reviewer/merger, run the validation chain (prettier auto-fix, typecheck, unit-app, unit-functions, e2e) on the caller's worktree; exit 2 blocks the SendMessage on failure. A per-worktree SHA cache short-circuits repeats. VALIDATE_DRY_RUN=1 skips the chain; =fail simulates a failure.

import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHookContext } from "./lib/context.mjs";
import { stringifyMessage } from "./lib/io.mjs";
import { sanitizePath } from "./lib/paths.mjs";
import { exec } from "./lib/process.mjs";
import {
  getFirstTaskId,
  isDeveloper,
  isMerger,
  isQualityReviewer,
  isTestValidator,
} from "./lib/teams.mjs";
import { taskWorktreePath } from "./lib/topology.mjs";
import { getActiveWorktrees, runValidationSteps } from "./lib/validation.mjs";

const stdin = readFileSync(0, "utf8");
const input = JSON.parse(stdin);
const ctx = createHookContext(input, "validate-before-review");

const cacheFile = (wt, suffix) =>
  join(ctx.sessionDir, `cache-${sanitizePath(wt)}${suffix}`);
const headOf = (wt) =>
  exec("git", ["-C", wt, "rev-parse", "HEAD"]).stdout.trim();
const readSha = (file) => {
  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    return "";
  }
};
const allAtCachedSha = (worktrees, suffix) =>
  worktrees.length > 0 &&
  worktrees.every((wt) => {
    const head = headOf(wt);
    return head && head === readSha(cacheFile(wt, suffix));
  });

const isGatedRecipient = (to) =>
  isQualityReviewer(to) || isTestValidator(to) || isMerger(to);

let logWt = "";
function finish(code) {
  ctx.log(`EXIT=${code} wt=${logWt}`);
  if (code === 2 && logWt) {
    const sha = headOf(logWt);
    if (sha) {
      try {
        writeFileSync(cacheFile(logWt, ".bad.sha"), sha);
      } catch {
        // best-effort
      }
    }
  }
  process.exit(code);
}

if (!stdin) finish(0);

const { agentName, agentType } = ctx;
const to = input.tool_input?.to || "";
ctx.log(`INVOKE agent_env='${agentName}' agent_type='${agentType}' to='${to}'`);

const callerIsDeveloper = isDeveloper(agentName) || isDeveloper(agentType);
if (!callerIsDeveloper) finish(0);

if (!isGatedRecipient(to)) finish(0);

const msgBody = stringifyMessage(input.tool_input?.message);
if (msgBody.includes("shutdown_request")) finish(0);

const taskId = getFirstTaskId(to) || getFirstTaskId(msgBody);
const validateWorktree = taskId ? taskWorktreePath(ctx, taskId) : "";
logWt = validateWorktree;

// Open the member-idle-gate for the recipient: the developer has validated and is
// messaging them, so they may start working. Flag read by member-idle-gate.mjs.
const openGate = () => {
  const role = isQualityReviewer(to)
    ? "qr"
    : isTestValidator(to)
      ? "tv"
      : isMerger(to)
        ? "merger"
        : "";
  if (!role || !taskId) return;
  const flagsDir = join(ctx.sessionDir, "flags");
  try {
    mkdirSync(flagsDir, { recursive: true });
    writeFileSync(join(flagsDir, `notified-${role}-${taskId}`), "");
    ctx.log(`NOTIFY ${role} task=${taskId}`);
  } catch {
    // best-effort
  }
};

// Same scope as the validation chain: the task worktree when the task id is
// known, otherwise all session worktrees.
const cacheWorktrees = getActiveWorktrees(ctx, validateWorktree);

if (allAtCachedSha(cacheWorktrees, ".sha")) {
  ctx.log(`CACHE HIT to=${to} (worktree at last-validated SHA)`);
  openGate();
  finish(0);
}

if (allAtCachedSha(cacheWorktrees, ".bad.sha")) {
  ctx.log(`FAIL-CACHE HIT to=${to} (SHA already failed)`);
  ctx.error(
    "This commit already failed validation. Fix the issue and make a new commit before messaging the reviewer.",
  );
  finish(2);
}

ctx.log(`START to=${to} wt=${validateWorktree}`);

const result = runValidationSteps(ctx, { worktree: validateWorktree });

if (!result.ok) {
  ctx.error(
    `Validation failed at step '${result.step}'. Fix the issue and commit before messaging the reviewer.`,
  );
  ctx.error(result.output);
  finish(2);
}

ctx.log(`ALL OK to=${to}${result.skipReason ? ` (${result.skipReason})` : ""}`);

if (!result.skipReason) {
  for (const wt of cacheWorktrees) {
    const head = headOf(wt);
    if (!head) continue;
    try {
      writeFileSync(cacheFile(wt, ".sha"), head);
    } catch {
      // best-effort
    }
    try {
      unlinkSync(cacheFile(wt, ".bad.sha"));
    } catch {
      // best-effort
    }
  }
}

openGate();
finish(0);
