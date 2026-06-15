#!/usr/bin/env node
// PreToolUse(Bash|Read|Grep|Glob|SendMessage) — prevent quality-reviewer-*,
// test-validator-* and merger-* from using any tool before the developer has sent
// them a "ready for review" message.
//
// Rationale: reviewers are dispatched simultaneously with the developer. Without
// this gate they read an empty worktree and send unsolicited "nothing to review"
// messages, confusing the developer and breaking the review loop.
//
// Signal: a flag file written by validate-before-review.mjs when the developer
// validates and messages the reviewer/merger. Flags live under <sessionDir>/flags
// (session-scoped, so a stale flag from a prior session never unblocks a reviewer):
//   notified-qr-TASK-XXX  (quality-reviewer-TASK-XXX)
//   notified-tv-TASK-XXX  (test-validator-TASK-XXX)
//   notified-merger-TASK-XXX / notified-merger-simple (merger)

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createHookContext } from "./lib/context.mjs";
import {
  getFirstTaskId,
  isMerger,
  isQualityReviewer,
  isTestValidator,
} from "./lib/teams.mjs";
import { simpleWorktreePath } from "./lib/topology.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "member-idle-gate");

// The runtime carries the agent's (possibly TASK-suffixed) identity in either
// agentName or agentType depending on context — check both.
const names = [ctx.agentName, ctx.agentType].filter(Boolean);
const isRole = (pred) => names.some(pred);

let gateType;
if (isRole(isQualityReviewer)) gateType = "qr";
else if (isRole(isTestValidator)) gateType = "tv";
else if (isRole(isMerger)) gateType = "merger";
else process.exit(0);

const flagsDir = join(ctx.sessionDir, "flags");
const toolInput = input.tool_input || {};
const toolInputStr = JSON.stringify(toolInput);
const simpleWt = simpleWorktreePath(ctx);

// Extract TASK_ID from the agent name first, then from tool_input fields.
let taskId = "";
for (const n of names) {
  const m = getFirstTaskId(n);
  if (m) {
    taskId = m;
    break;
  }
}
if (!taskId) {
  const candidates = [
    toolInput.file_path,
    toolInput.command,
    toolInput.path,
    toolInput.to,
    toolInput.message,
    toolInputStr,
  ];
  for (const s of candidates) {
    const m = getFirstTaskId(s);
    if (m) {
      taskId = m;
      break;
    }
  }
}

const touch = (path) => {
  try {
    mkdirSync(flagsDir, { recursive: true });
    writeFileSync(path, "");
  } catch {
    // best-effort
  }
};

if (!taskId) {
  // Merger special cases.
  if (gateType === "merger") {
    let mergerFlag = "";
    try {
      mergerFlag =
        readdirSync(flagsDir).find((f) => f.startsWith("notified-merger-")) ||
        "";
    } catch {
      mergerFlag = "";
    }
    if (mergerFlag) {
      ctx.log(
        `PASS agent=${names.join("/")} task=any (session merger flag: ${mergerFlag})`,
      );
      process.exit(0);
    }
    // SIMPLE flow: orchestrator dispatches merger directly (no SendMessage, no
    // validate-before-review) so no merger flag is ever written. Detect by the
    // SIMPLE worktree path in tool_input.
    if (toolInputStr.includes(simpleWt)) {
      touch(join(flagsDir, "notified-merger-simple"));
      ctx.log(`PASS agent=${names.join("/")} task=simple (SIMPLE flow)`);
      process.exit(0);
    }
  }
  // Migration-round reviewer bypass: a quality-reviewer on the migration worktree
  // is dispatched sequentially AFTER the SQL is written — no empty-worktree race.
  if (gateType === "qr" && toolInputStr.includes(simpleWt)) {
    ctx.log(
      `PASS agent=${names.join("/")} task=migration (migration-review bypass)`,
    );
    process.exit(0);
  }
  // No TASK_ID anywhere — block conservatively.
  ctx.fail(
    `Cannot determine TASK_ID for agent '${names.join("/")}'.\n` +
      'Do NOT call any tool until you receive the developer\'s "ready for review" SendMessage.',
    { log: `BLOCK-NOTASK gate=${gateType}` },
  );
}

const flag = {
  qr: join(flagsDir, `notified-qr-${taskId}`),
  tv: join(flagsDir, `notified-tv-${taskId}`),
  merger: join(flagsDir, `notified-merger-${taskId}`),
}[gateType];

if (!existsSync(flag)) {
  ctx.fail(
    `Your flag (${flag}) does not exist yet.\n` +
      'The developer has not sent you a "ready for review" message.\n' +
      "Do NOT call any tool (Read, Bash, Grep, SendMessage…). Idle until the developer's first SendMessage.",
    { log: `BLOCK task=${taskId} flag=${flag} not found` },
  );
}

ctx.log(`PASS agent=${names.join("/")} task=${taskId}`);
process.exit(0);
