#!/usr/bin/env node
// SubagentStop — full validation chain (prettier auto-fix, typecheck, unit app/functions, e2e) on active worktrees with changes; exit 2 keeps the subagent alive to fix and commit. VALIDATE_DRY_RUN=1 skips the chain; =fail simulates a failure.

import { existsSync, readFileSync } from "node:fs";
import { createHookContext } from "./lib/context.mjs";
import { git } from "./lib/git.mjs";
import { getFirstTaskId } from "./lib/teams.mjs";
import {
  sessionBranch,
  simpleWorktreePath,
  taskWorktreePath,
} from "./lib/topology.mjs";
import { runValidationSteps } from "./lib/validation.mjs";

const raw = readFileSync(0, "utf8");
const ctx = createHookContext(raw, "validate");
let payload = {};
try {
  payload = JSON.parse(raw);
} catch {
  payload = {};
}

// Scope validation to the stopping subagent's OWN worktree: developer-TASK-XXX
// validates <base>/TASK-XXX, simple-developer validates <base>/simple. Avoids the
// "shared brakes" failure where one ticket's broken state blocks an unrelated
// developer and N stops each re-validate every session worktree. Falls back to
// all session worktrees when the identity can't be resolved.
const ids = [ctx.agentName, ctx.agentType].filter(Boolean);
const isSimple = ids.some((n) => /simple-developer/.test(n));
let taskId = ids.map(getFirstTaskId).find(Boolean) || "";

// No suffixed agent name in this harness → recover TASK_ID from the dispatch
// prompt in the transcript, to scope validation to this dev's worktree (not wt=all).
if (!taskId && !isSimple) {
  const tp = payload.agent_transcript_path || payload.transcript_path;
  if (tp && existsSync(tp)) {
    try {
      const body = readFileSync(tp, "utf8");
      for (const line of body.split("\n")) {
        const m =
          line.match(/TASK_ID[:=\s]+(TASK-\d+)/) ||
          line.match(/TICKET_FILE[=:\s]+\S*(TASK-\d+)/);
        if (m) {
          taskId = m[1];
          break;
        }
      }
    } catch {
      // best-effort — fall back to all-worktree validation below
    }
  }
}

const ownWorktree = taskId
  ? taskWorktreePath(ctx, taskId)
  : isSimple
    ? simpleWorktreePath(ctx)
    : "";

// Diff each worktree against the branch it forked from (session/<short>), not the
// repo's checked-out base branch, so validation sees the ticket's OWN change set.
// Empty base → validation.mjs falls back to the repo base branch (e.g. before the
// session branch exists).
const sessionRef = sessionBranch(ctx);
const base =
  git(["show-ref", "--verify", "--quiet", `refs/heads/${sessionRef}`])
    .status === 0
    ? sessionRef
    : "";

ctx.log(
  `START REPO=${ctx.repo} MODE=${process.env.MODE || ""} wt=${ownWorktree || "all"} base=${base || "repo-default"}`,
);

const result = runValidationSteps(ctx, { worktree: ownWorktree, base });

if (!result.ok) {
  ctx.fail(
    `Validation failed at step '${result.step}' — fix the errors and commit before completing:\n` +
      result.output,
    { log: `step=${result.step}` },
  );
}

ctx.accept(result.skipReason || `OK (${ownWorktree || "all worktrees"})`);
