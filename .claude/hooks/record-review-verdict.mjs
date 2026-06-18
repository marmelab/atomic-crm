#!/usr/bin/env node
// SubagentStop(quality-reviewer|test-validator) — record each reviewer's verdict
// as a per-ticket flag so block-merger-without-review.mjs can enforce
// dev -> reviewers -> merger. SubagentStop cannot block — it only records.
//
// Flag (presence == APPROVED): <sessionDir>/reviews/<TASK>-<role>. Cleared on
// REJECTED here; cleared on a developer (re)dispatch by setup-worktree.mjs so a
// changed diff invalidates stale approvals.
//
// Verdict source: the reviewer's final contract line (exactly `APPROVED` or
// `REJECTED: ...`). Read from last_assistant_message when the runtime provides
// it, else from the JSONL transcript's last assistant text block. When the
// verdict can't be recovered, the flag is left untouched — never written on a
// guess (a dev re-dispatch is what invalidates a stale verdict).

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHookContext } from "./lib/context.mjs";
import {
  getFirstTaskId,
  isQualityReviewer,
  isTestValidator,
} from "./lib/teams.mjs";
import { reviewFlag, reviewsDir } from "./lib/reviews.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "record-review-verdict");

// Role + task from the (suffixed) agent identity, e.g. quality-reviewer-TASK-001.
const ids = [ctx.agentName, ctx.agentType].filter(Boolean);
let role = ids.some(isQualityReviewer)
  ? "quality-reviewer"
  : ids.some(isTestValidator)
    ? "test-validator"
    : "";
let task = "";
for (const n of ids) {
  const m = getFirstTaskId(n);
  if (m) {
    task = m;
    break;
  }
}

// No suffixed agent name in this harness → recover task/role from the dispatch
// prompt in the transcript. Done unconditionally: lastAssistantText() returns
// early on last_assistant_message, bypassing its own recovery (→ task=UNKNOWN).
if (!role || !task) {
  const tp = input.agent_transcript_path || input.transcript_path;
  if (tp && existsSync(tp)) {
    let body = "";
    try {
      body = readFileSync(tp, "utf8");
    } catch {
      body = "";
    }
    for (const line of body.split("\n")) {
      if (!role) {
        const m = line.match(
          /(?:^|\\n|")ROLE:\s*(quality-reviewer|test-validator)/,
        );
        if (m) role = m[1];
      }
      if (!task) {
        const m =
          line.match(/TASK_ID[:=\s]+(TASK-\d+)/) ||
          line.match(/TICKET_FILE[=:\s]+\S*(TASK-\d+)/);
        if (m) task = m[1];
      }
      if (role && task) break;
    }
  }
}

// Last assistant text: prefer the payload field, fall back to the transcript.
// While scanning the transcript, recover role/task from the dispatch prompt
// (ROLE: / TICKET_FILE:) when the agent name didn't carry them.
const lastAssistantText = () => {
  if (
    typeof input.last_assistant_message === "string" &&
    input.last_assistant_message.trim()
  ) {
    return input.last_assistant_message;
  }
  const tp = input.agent_transcript_path || input.transcript_path;
  if (!tp || !existsSync(tp)) return "";
  let body = "";
  try {
    body = readFileSync(tp, "utf8");
  } catch {
    return "";
  }
  let lastText = "";
  for (const line of body.split("\n")) {
    if (!line.trim()) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const msg = e.message || e;
    const content = msg && msg.content;
    if (Array.isArray(content)) {
      for (const b of content) {
        if (
          b &&
          b.type === "text" &&
          typeof b.text === "string" &&
          b.text.trim()
        )
          lastText = b.text;
      }
    } else if (typeof content === "string" && content.trim()) {
      lastText = content;
    }
    if (!role) {
      // Anchor to a dispatch-line boundary — start of the JSONL record, an
      // escaped newline (\n inside the JSON string), or the prompt field's
      // opening quote — so an inline prose mention ("...the ROLE: test-validator
      // agent...") cannot mis-assign the role.
      const m = line.match(
        /(?:^|\\n|")ROLE:\s*(quality-reviewer|test-validator)/,
      );
      if (m) role = m[1];
    }
    if (!task) {
      // Anchor to the dispatch's TASK_ID / TICKET_FILE lines only. A bare
      // /TASK-\d+/ scan would latch onto the FIRST ticket mentioned anywhere in
      // the transcript (e.g. "TASK-001 is merged, now review TASK-002"), keying
      // the verdict flag to the wrong ticket.
      const m =
        line.match(/TASK_ID[:=\s]+(TASK-\d+)/) ||
        line.match(/TICKET_FILE[=:\s]+\S*(TASK-\d+)/);
      if (m) task = m[1];
    }
  }
  return lastText;
};

// Verdict = the last CLEAN contract marker, read bottom-up. The contract puts the
// verdict on the final line: a bare `APPROVED`, or `REJECTED:` followed by a
// bulleted feedback list (so the REJECTED marker is NOT the last line). We scan
// upward from the bottom and take the first clean marker, skipping feedback
// bullets and trailing prose. Two deliberate asymmetries stop a chatty trailing
// line from FLIPPING a real verdict:
//   - APPROVED matches only a standalone `APPROVED` (optionally trailing
//     punctuation) — not "APPROVED parts: ..." prose.
//   - REJECTED requires the contract colon `REJECTED:` — so a trailing sentence
//     like "REJECTED concerns are resolved" after a real APPROVED is ignored.
// A line that is neither a clean marker nor a feedback bullet is skipped (keep
// scanning up); if none is found the verdict is UNKNOWN and the flag is untouched.
const src = lastAssistantText();
const isApproved = (l) => l.replace(/[.!\s]+$/, "") === "APPROVED";
const isRejected = (l) => /^REJECTED:/.test(l);
let verdict = "";
const verdictLines = src.split("\n").map((s) => s.trim());
for (let i = verdictLines.length - 1; i >= 0; i--) {
  const line = verdictLines[i];
  if (!line) continue;
  if (isRejected(line)) {
    verdict = "REJECTED";
    break;
  }
  if (isApproved(line)) {
    verdict = "APPROVED";
    break;
  }
}

ctx.log(
  `role=${role || "UNKNOWN"} task=${task || "UNKNOWN"} verdict=${verdict || "UNKNOWN"}`,
);

if (!role || !task) process.exit(0); // can't key the flag — leave state untouched

const flag = reviewFlag(ctx, task, role);
if (verdict === "APPROVED") {
  try {
    mkdirSync(reviewsDir(ctx), { recursive: true });
    writeFileSync(flag, "");
  } catch {
    // best-effort
  }
} else if (verdict === "REJECTED") {
  try {
    rmSync(flag, { force: true });
  } catch {
    // best-effort
  }
}
// UNKNOWN verdict: leave the flag untouched.
process.exit(0);
