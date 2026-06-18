#!/usr/bin/env node
// PreToolUse(Agent) — force `developer` dispatches onto the session worktree that
// setup-worktree creates (WORKTREE_PATH in the prompt), forbid the Agent tool's
// own isolation:"worktree" (which spawns off-convention `worktree-agent-*`
// branches outside the session-branch topology — breaking Stage A merges and the
// migration diff baseline), and forbid run_in_background:true (STATE B is fully
// synchronous — a detached developer would let the orchestrator advance before
// the worktree is finished). Keeps the orchestrator on the STATE B dispatch
// template instead of improvising a free-form prompt.
//
// simple-developer is intentionally NOT gated here: setup-worktree derives its
// fixed <short>/simple worktree from the session even when the SIMPLE template
// omits WORKTREE_PATH (the COMPLEX developer has no such fallback — its path is
// per-ticket and must be carried explicitly).
//
// The promotion-conflict-resolver is also a `developer` dispatch but is the one
// sanctioned exception that works in $REPO on `main` under the promote lock (see
// worktree-scope.md), so it carries no WORKTREE_PATH on purpose — exempt it, or
// this gate would block the only path that can finish a session->main promotion
// after a merge conflict.

import { readFileSync } from "node:fs";
import { createHookContext } from "./lib/context.mjs";
import { parseDispatch } from "./lib/dispatch-parse.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "enforce-dev-dispatch");
const d = parseDispatch(input);

if (d.subagentType !== "developer") process.exit(0);

if (d.role === "promotion-conflict-resolver") {
  ctx.accept(
    "promotion-conflict-resolver — operates in $REPO on main, no worktree",
  );
}

if (d.isolation === "worktree") {
  ctx.fail(
    "developer must NOT use isolation:worktree — setup-worktree already creates <WORKTREE_BASE>/TASK-XXX. Drop isolation and pass WORKTREE_PATH + BRANCH_NAME in the prompt (STATE B template).",
    { log: "BLOCK isolation=worktree" },
  );
}

if (d.runInBackground) {
  ctx.fail(
    "developer must NOT be dispatched with run_in_background:true — STATE B drives every wave synchronously in the foreground (a foreground Agent call blocks until the subagent returns). A detached developer would let the orchestrator advance to review/merge before the worktree is finished. Drop run_in_background.",
    { log: "BLOCK run_in_background" },
  );
}

if (!d.worktreePath) {
  ctx.fail(
    "developer dispatch prompt is missing 'WORKTREE_PATH: <WORKTREE_BASE>/TASK-XXX' (and BRANCH_NAME). Use the STATE B dispatch template verbatim instead of a free-form prompt.",
    { log: "BLOCK missing WORKTREE_PATH" },
  );
}

process.exit(0);
