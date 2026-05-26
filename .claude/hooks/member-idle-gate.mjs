#!/usr/bin/env node
// PreToolUse hook — prevents quality-reviewer-* and test-validator-* from using
// any tool before the developer has sent them a "ready for review" message.
//
// Rationale: reviewers are dispatched simultaneously with the developer. Without
// this gate they read an empty worktree and send unsolicited "nothing to review"
// messages, confusing the developer and breaking the review loop.
//
// Why NOT check the team inbox file: reviewers are dispatched with their task
// context already in the spawn prompt (a <teammate-message> from team-lead), so
// the inbox has 1 message immediately at spawn time — an inbox COUNT >= 1 check
// would always pass. The flag file written by validate-before-review is the
// correct signal: it appears only when the developer explicitly validates and
// sends "ready for review", which is a strictly later event.
//
// Flags (under flagsDir, already session-scoped so a stale flag from a previous
// session never unblocks a reviewer in a new one):
//   notified-qr-TASK-XXX  (quality-reviewer-TASK-XXX)
//   notified-tv-TASK-XXX  (test-validator-TASK-XXX)
//   notified-merger-TASK-XXX / notified-merger-simple (merger)

import { existsSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readStdin, parseJson, crmIdentity } from "./lib/common.mjs";

const input = parseJson(readStdin());
const ctx = crmIdentity(input);

// crm_identity sets agentType to the full agent name (e.g. "quality-reviewer-
// TASK-001") for in-process teammates, falling back to CLAUDE_AGENT_NAME.
const agent = ctx.agentType;

let gateType;
if (/^quality-reviewer(-|$)/.test(agent)) gateType = "qr";
else if (/^test-validator(-|$)/.test(agent)) gateType = "tv";
else if (/^merger(-|$)/.test(agent)) gateType = "merger";
else process.exit(0);

const toolInput = input.tool_input || {};

// Extract TASK_ID: first from the agent name, then from tool_input fields.
let taskId = (agent.match(/TASK-[0-9]+/) || [])[0] || "";
if (!taskId) {
  const candidates = [
    toolInput.file_path || "",
    toolInput.command || "",
    toolInput.path || "",
    toolInput.to || "",
    toolInput.message || "",
    JSON.stringify(toolInput),
  ];
  for (const s of candidates) {
    const m = String(s).match(/TASK-[0-9]+/);
    if (m) {
      taskId = m[0];
      break;
    }
  }
}

const touch = (path) => {
  try {
    mkdirSync(ctx.flagsDir, { recursive: true });
    writeFileSync(path, "");
  } catch {
    // best-effort
  }
};

const blockNoTask = () => {
  ctx.log(`member-idle-gate BLOCK-NOTASK agent=${agent} gate=${gateType} (no TASK_ID in input)`);
  process.stderr.write(
    `[member-idle-gate] Cannot determine TASK_ID for agent '${agent}'.\n` +
      `Do NOT call any tool until you receive the developer's "ready for review" SendMessage.\n`
  );
  process.exit(2);
};

const simpleWt = join(ctx.worktreeBase, "simple");
const toolInputStr = JSON.stringify(toolInput);

if (!taskId) {
  // Merger special case: the merger often runs git/shell commands that don't
  // mention TASK-XXX. Once the developer has validated and sent to the merger,
  // a notified-merger-* flag exists → allow all its tool calls.
  if (gateType === "merger") {
    let mergerFlag = "";
    try {
      mergerFlag = readdirSync(ctx.flagsDir).find((f) => f.startsWith("notified-merger-")) || "";
    } catch {
      mergerFlag = "";
    }
    if (mergerFlag) {
      ctx.log(`member-idle-gate PASS agent=${agent} task=any (session merger flag: ${mergerFlag})`);
      process.exit(0);
    }
    // SIMPLE flow: orchestrator dispatches merger directly (no SendMessage, no
    // validate-before-review) so no merger flag is ever written. Detect by the
    // presence of the SIMPLE worktree path in tool_input.
    if (toolInputStr.includes(simpleWt)) {
      touch(join(ctx.flagsDir, "notified-merger-simple"));
      ctx.log(`member-idle-gate PASS agent=${agent} task=simple (SIMPLE flow, wrote notified-merger-simple)`);
      process.exit(0);
    }
  }
  // Migration-round reviewer bypass: a quality-reviewer operating on the
  // migration worktree (<worktreeBase>/simple) is dispatched sequentially AFTER
  // the SQL is written — the empty-worktree race cannot happen. Allow it.
  if (gateType === "qr" && toolInputStr.includes(simpleWt)) {
    ctx.log(`member-idle-gate PASS agent=${agent} task=migration (migration-review bypass)`);
    process.exit(0);
  }
  // No TASK_ID anywhere — block conservatively.
  blockNoTask();
}

const flag = {
  qr: join(ctx.flagsDir, `notified-qr-${taskId}`),
  tv: join(ctx.flagsDir, `notified-tv-${taskId}`),
  merger: join(ctx.flagsDir, `notified-merger-${taskId}`),
}[gateType];

if (!existsSync(flag)) {
  ctx.log(`member-idle-gate BLOCK agent=${agent} task=${taskId} flag=${flag} not found`);
  process.stderr.write(
    `[member-idle-gate] Your flag (${flag}) does not exist yet.\n` +
      `The developer has not sent you a "ready for review" message.\n` +
      `Do NOT call any tool (Read, Bash, Grep, SendMessage…).\n` +
      `Idle until you receive the developer's first SendMessage.\n`
  );
  process.exit(2);
}

ctx.log(`member-idle-gate PASS agent=${agent} task=${taskId}`);
process.exit(0);
