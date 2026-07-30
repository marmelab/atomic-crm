#!/usr/bin/env node
// PreToolUse(Agent): record whether the merger being dispatched is authorized to
// run Stage B (promotion of the session branch into the base branch). Written to
// <sessionDir>/merger-stage.json at dispatch time; read by
// block-wave-merger-promote.mjs when the merger runs its git commands.
//
// Why the bridge: a per-ticket wave merger (TASK_ID: TASK-XXX, no MODE) is a
// Stage-A-only dispatch (merger.md "TASK-XXX -> Stage A only") and must NOT promote.
// The dispatch itself is legitimate, so the violation can only be caught when the
// merger runs the Stage-B git commands. A PreToolUse(Bash) hook cannot see the
// merger's dispatch prompt, so its authorization is recorded here at dispatch.
//
// Race safety: wave mergers are dispatched sequentially and foreground
// (merger.md, Stage 3), and promotion is a single dispatch after the last wave, so
// there is never more than one merger running at a time. A single-slot marker
// therefore always describes the currently-running merger.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHookContext } from "./lib/context.mjs";
import { parseDispatch } from "./lib/dispatch-parse.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const d = parseDispatch(input);

// Only a merger dispatch carries promotion authorization.
if (d.subagentType !== "merger") process.exit(0);

const ctx = createHookContext(input, "record-merger-stage");

// A dispatch is Stage-A-only (may NOT promote) when it either carries STAGE: a-only
// or is a per-ticket wave merge (TASK_ID matches TASK-<n>). Every other merger
// dispatch (MODE: promote, or a SIMPLE / MIGRATION / ROLLBACK single-shot, none of
// which set a TASK-<n> id) legitimately promotes.
const stageAOnly = d.stage === "a-only" || /^TASK-\d+$/.test(d.taskId);
const promote = !stageAOnly;

try {
  mkdirSync(ctx.sessionDir, { recursive: true });
  writeFileSync(
    join(ctx.sessionDir, "merger-stage.json"),
    JSON.stringify({
      promote,
      taskId: d.taskId,
      mode: d.mode,
      stage: d.stage,
      at: new Date().toISOString(),
    }) + "\n",
  );
  ctx.log(
    `RECORD promote=${promote} taskId=${d.taskId || "-"} mode=${d.mode || "-"} stage=${d.stage || "-"}`,
  );
} catch {
  // Best-effort: the Bash guard fails CLOSED when the marker is missing/unreadable,
  // so a failed write cannot silently allow an unauthorized promotion.
}
process.exit(0);
