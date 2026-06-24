#!/usr/bin/env node
// PreToolUse(Agent) — before a developer subagent starts, create its git
// worktree (forked from the session integration branch) and provision
// node_modules. Fires on the orchestrator's Agent dispatch, where the dispatched
// identity (subagent_type, name, prompt) is available — unlike SubagentStart,
// which in a parallel wave cannot tell which of N developers is starting, so it
// cannot know the TASK_ID / worktree to create.
//
// Identity: a real TASK id (TASK-001) from the prompt's TASK_ID line or the
// dispatch name (developer-TASK-001) → <base>/<TASK_ID> (per-ticket wave); a
// developer dispatch on the <short>/simple branch (rollback-conflict / migration,
// no task) → <base>/simple. Paths are derived from topology (authoritative),
// matching the value the orchestrator substitutes into WORKTREE_PATH.
//
// Also resets stale review verdicts for a (re)dispatched developer, so a changed
// diff cannot pass block-merger-without-review on a previous attempt's APPROVED.
//
// Recovery: already-registered worktree → skip (restart / retry); orphan dir →
// rm -rf then recreate; orphan branch with no worktree → force-delete so -b works.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { createHookContext } from "./lib/context.mjs";
import { parseDispatch } from "./lib/dispatch-parse.mjs";
import { getBaseBranch, getWorktreePaths, git } from "./lib/git.mjs";
import { REVIEW_ROLES, reviewFlag } from "./lib/reviews.mjs";
import { getFirstTaskId } from "./lib/teams.mjs";
import {
  simpleBranch,
  simpleWorktreePath,
  sessionBaseBranch,
  sessionBranch,
  sessionWorktreePath,
  taskBranch,
  taskWorktreePath,
} from "./lib/topology.mjs";

// Advisory-lock tuning (see the acquire loop below). LOCK_ACQUIRE_TIMEOUT_MS must
// stay comfortably under this hook's PreToolUse timeout in settings.json so a
// waiter gives up and proceeds best-effort rather than being killed mid-run.
const LOCK_ACQUIRE_TIMEOUT_MS = 20_000;
const LOCK_STALE_MS = 60_000;
const LOCK_SPIN_MS = 100;

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "setup-worktree");
const d = parseDispatch(input);

// Only act on developer dispatches; reviewers, merger, planner and documentator
// reuse (or never touch) a worktree.
if (d.subagentType !== "developer") {
  process.exit(0);
}

// A developer dispatch whose branch/worktree is <short>/simple runs single-shot on
// the shared <base>/simple worktree (rollback-conflict replay, deploy-time
// migration) instead of a per-ticket one. The /simple branch is the discriminator;
// every other developer dispatch is a per-ticket wave developer.
const isSimple =
  /\/simple$/.test(d.branchName) || /\/simple$/.test(d.worktreePath);

const taskId =
  (/^TASK-\d+$/.test(d.taskId) && d.taskId) || getFirstTaskId(d.name);

let worktreePath;
let branchName;
if (taskId) {
  worktreePath = taskWorktreePath(ctx, taskId);
  branchName = taskBranch(ctx, taskId);
} else if (isSimple) {
  worktreePath = simpleWorktreePath(ctx);
  branchName = simpleBranch(ctx);
} else if (d.role === "promotion-conflict-resolver") {
  // The sanctioned $REPO-on-main exception (see enforce-dev-dispatch /
  // worktree-scope): it works directly in the repo under the promote lock and
  // owns no task worktree, so there is nothing to create here.
  ctx.accept(
    "promotion-conflict-resolver — operates in $REPO on main, no worktree",
  );
} else {
  // A developer that passed enforce-dev-dispatch (so it carries WORKTREE_PATH)
  // but is neither a resolvable TASK-XXX nor an <short>/simple dispatch. We can't
  // derive the canonical worktree path; accepting would let the developer cd into
  // a directory that was never created. Fail closed instead.
  ctx.fail(
    "developer dispatch carries WORKTREE_PATH but no resolvable TASK-XXX id and no <short>/simple branch (expected a 'TASK_ID: TASK-XXX' line, a 'developer-TASK-XXX' name, or 'BRANCH_NAME: <SESSION_SHORT_ID>/simple'). Use the STATE B dispatch template.",
    { log: "BLOCK unresolvable task id" },
  );
}

mkdirSync(ctx.sessionDir, { recursive: true });

// Serialise the git-mutation region per session: a wave dispatches N
// developers in ONE orchestrator message, so N PreToolUse hooks can fire nearly
// together and race on session-branch / _session creation and git's internal
// worktree locks. A best-effort advisory lock (atomic mkdir + bounded spin,
// 60s stale-steal) serialises them; released on any exit via the exit handler.
const lockDir = join(ctx.sessionDir, ".setup-worktree.lock");
const sleepSync = (ms) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
let locked = false;
const deadline = Date.now() + LOCK_ACQUIRE_TIMEOUT_MS;
while (Date.now() < deadline) {
  try {
    mkdirSync(lockDir);
    locked = true;
    break;
  } catch (e) {
    if (e.code !== "EEXIST") break; // can't lock — proceed best-effort
    try {
      if (Date.now() - statSync(lockDir).mtimeMs > LOCK_STALE_MS) {
        rmSync(lockDir, { recursive: true, force: true });
        continue;
      }
    } catch {
      continue; // lock vanished — retry immediately
    }
    sleepSync(LOCK_SPIN_MS);
  }
}
// Release the advisory lock. Idempotent (guarded by `locked`) so it is safe to
// call explicitly once the git-mutation region is done — releasing before the
// slow node_modules provisioning keeps the critical section short — and again on
// exit as a backstop.
const releaseLock = () => {
  if (!locked) return;
  try {
    rmdirSync(lockDir);
  } catch {
    // best-effort
  }
  locked = false;
};
process.on("exit", releaseLock);

const base = getBaseBranch();
const integrationBranch = sessionBranch(ctx);
const sessionWt = sessionWorktreePath(ctx);

// Worktrees whose node_modules is provisioned AFTER the lock is released (see
// the explicit releaseLock() below). cp -a of node_modules can take 20-40s on a
// cross-mount dev container; doing it under the lock made parallel-wave waiters
// exceed the acquire deadline and run the git-mutation region unlocked.
const toProvision = [];

if (
  git(["show-ref", "--verify", "--quiet", `refs/heads/${integrationBranch}`])
    .status !== 0
) {
  git(["branch", integrationBranch, base]);
  git(["branch", sessionBaseBranch(ctx), base]);
}

// Record the fork-base branch NAME so promotion (merger Stage B) merges the
// session's work back into the branch it was forked from — the source branch the
// user is on — instead of always targeting the repo default (main). The
// session-base/<short> ref records the fork COMMIT but not the name, so the name
// is captured here. Written only when missing: that pins the value at fork time
// and never overwrites it with a later, possibly drifted, $REPO HEAD. The key
// lives for the whole session — like session/<short> and session-base/<short> it
// is NOT torn down per request (cleanup-worktree leaves it in place); clean-harness
// removes it at session teardown. Keyed by session short id (a config subsection,
// so any short id is valid).
const baseBranchKey = `sessionbase.${ctx.sessionShort}.branch`;
if (!git(["config", "--get", baseBranchKey]).stdout.trim()) {
  git(["config", "--local", baseBranchKey, base]);
}

if (!existsSync(join(sessionWt, ".git"))) {
  rmSync(sessionWt, { recursive: true, force: true });
  mkdirSync(dirname(sessionWt), { recursive: true });
  git(["worktree", "prune"]);
  const add = git(["worktree", "add", sessionWt, integrationBranch]);
  if (add.status === 0) {
    toProvision.push(sessionWt);
    ctx.log(`SESSION-BRANCH created ${integrationBranch} from ${base}`);
  } else {
    ctx.log(
      `SESSION-BRANCH FAILED _session ${integrationBranch} err=${add.stderr.replace(/\n/g, " ")}`,
    );
  }
}

// A (re)dispatched developer means the diff will change — invalidate any prior
// review verdicts for this ticket so a stale APPROVED can't let the merger
// through before the new attempt is re-reviewed.
if (taskId) {
  for (const r of REVIEW_ROLES) {
    try {
      rmSync(reviewFlag(ctx, taskId, r), { force: true });
    } catch {
      // best-effort
    }
  }
}

ctx.log(
  `START agent=${d.subagentType}${d.mode ? ` mode=${d.mode}` : ""} path=${worktreePath} branch=${branchName}`,
);

if (getWorktreePaths().includes(worktreePath)) {
  ctx.accept(`already registered (${worktreePath})`);
}

if (existsSync(worktreePath)) {
  rmSync(worktreePath, { recursive: true, force: true });
  ctx.log(`REMOVED orphan dir ${worktreePath}`);
}

mkdirSync(dirname(worktreePath), { recursive: true });

if (git(["branch", "--list", branchName]).stdout.trim()) {
  git(["branch", "-D", branchName]);
  ctx.log(`DELETED orphan branch ${branchName}`);
}

const add = git([
  "worktree",
  "add",
  worktreePath,
  "-b",
  branchName,
  integrationBranch,
]);
if (add.status !== 0) {
  ctx.fail(
    `Cannot create worktree at ${worktreePath} (branch=${branchName}): ${add.stderr}\n`,
    { log: `path=${worktreePath} err=${add.stderr}` },
  );
}
ctx.log(`CREATED branch=${branchName} path=${worktreePath}`);
toProvision.push(worktreePath);

// Git-mutation region is done — release the lock before provisioning so a
// parallel-wave waiter can serialise its own git ops while this hook copies
// node_modules. Distinct target dirs, copied from $REPO, so the copies can run
// concurrently without racing.
releaseLock();

try {
  for (const wt of toProvision) ctx.linkNodeModules(wt);
} catch (e) {
  // Fail closed (exit 2 → block the dispatch): a developer must not start in a
  // worktree with no dependencies. An uncaught throw would exit 1, which a
  // PreToolUse hook treats as non-blocking — letting the broken dispatch run.
  ctx.fail(
    `node_modules provisioning failed for ${worktreePath}: ${e.message}`,
    { log: `provision-failed wt=${worktreePath}` },
  );
}

ctx.accept(`OK wt=${worktreePath}`);
