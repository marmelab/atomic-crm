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

// Scope validation to the stopping subagent's OWN worktree: a per-ticket
// developer-TASK-XXX validates <base>/TASK-XXX, a single-shot simple developer (on
// the <short>/simple branch — rollback / migration) validates <base>/simple. Avoids the
// "shared brakes" failure where one ticket's broken state blocks an unrelated
// developer and N stops each re-validate every session worktree. Falls back to
// all session worktrees when the identity can't be resolved.
const ids = [ctx.agentName, ctx.agentType].filter(Boolean);
let taskId = ids.map(getFirstTaskId).find(Boolean) || "";
// A single-shot simple developer runs on the shared <base>/simple worktree; its agent
// name carries no TASK suffix, so it's recovered from the dispatch prompt below.
let isSimple = false;

// No suffixed agent name in this harness → recover the TASK_ID (or the single-shot
// simple flow) from the dispatch prompt in the transcript, to scope validation to
// this dev's worktree (not wt=all).
if (!taskId) {
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
        if (/BRANCH_NAME[:=\s]+\S+\/simple\b/.test(line)) {
          isSimple = true;
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

// Diff each worktree against session/<short>, not the repo's checked-out base
// branch, so validation sees a per-ticket developer's OWN change set. (A
// single-shot simple developer is the exception: resolving-rollback-conflicts does
// `git reset --hard <BASE_BRANCH>`, re-forking <short>/simple onto the default
// branch, so its diff against session/<short> can span unrelated files — accepted
// noise, since the rollback's whole point is to diverge from the session.)
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
