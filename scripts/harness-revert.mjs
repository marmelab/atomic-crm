#!/usr/bin/env node
//
// Per-session revert for the agent harness.
//
// Undoes ONE harness session's promoted work and removes its artifacts, leaving
// every other (possibly parallel) session untouched. Replaces a global hard-reset:
// instead of resetting the branch to a single fork anchor (which would wipe a
// parallel session that landed on the same branch), it reverts only THIS session's
// promotion merge commits, keyed by SESSION_SHORT_ID.
//
// Driven by the `/harness-revert` slash command (portable across CLI / VS Code
// extension / desktop), which resolves the short id and confirms before calling
// this. It can also be run directly.
//
// How a session lands on the base branch: the merger promotes with
//   git merge --no-ff session/<short> -m "merge(session): <short>"
// (see .claude/agents/merger.md, Stage B). So this session's footprint on the base
// branch is exactly the merge commits whose subject is "merge(session): <short>".
//
// Usage:
//   scripts/harness-revert.mjs <SESSION_SHORT_ID>            # revert + clean up
//   scripts/harness-revert.mjs <SESSION_SHORT_ID> --dry-run  # print, change nothing
//
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run") || argv.includes("-n");
const HARD = argv.includes("--hard");
const SHORT = argv.find((a) => !a.startsWith("-"));

const log = (msg) => process.stdout.write(`${msg}\n`);
const err = (msg) => process.stderr.write(`${msg}\n`);

if (!SHORT) {
  err("usage: harness-revert.mjs <SESSION_SHORT_ID> [--hard] [--dry-run]");
  process.exit(2);
}

// Run git, capturing output. Returns { code, out, err }.
function git(args) {
  const res = spawnSync("git", args, { encoding: "utf8" });
  return {
    code: res.status ?? (res.error ? 1 : 0),
    out: (res.stdout || "").trim(),
    err: (res.stderr || "").trim(),
  };
}

// Run a mutating git command, honouring --dry-run.
function gitRun(args) {
  if (DRY_RUN) {
    log(`[dry-run] git ${args.join(" ")}`);
    return { code: 0, out: "", err: "" };
  }
  return git(args);
}

// Repo root (authoritative via git; falls back to env/cwd).
const top = git(["rev-parse", "--show-toplevel"]);
const REPO_ROOT =
  (top.code === 0 && top.out) ||
  process.env.CLAUDE_PROJECT_DIR ||
  process.cwd();
process.chdir(REPO_ROOT);

const CURRENT_BRANCH = git(["rev-parse", "--abbrev-ref", "HEAD"]).out;
const BASE_BRANCH = git([
  "config",
  "--local",
  "--get",
  `sessionbase.${SHORT}.branch`,
]).out;

log(`==> Session:     ${SHORT}`);
log(`==> Base branch: ${BASE_BRANCH || "(unknown — cleanup only)"}`);
if (DRY_RUN) log("==> Mode:        DRY-RUN (no changes)");

if (HARD)
  log("==> Mode:        HARD (reset to fork — drops the session's commits)");

// Guard: undoing commits requires being ON the base branch the session promoted to.
const requireOnBase = () => {
  if (BASE_BRANCH && CURRENT_BRANCH !== BASE_BRANCH) {
    err(
      `!! You are on '${CURRENT_BRANCH}' but session ${SHORT} promoted onto '${BASE_BRANCH}'.`,
    );
    err(`   Switch to it first:  git checkout ${BASE_BRANCH}`);
    process.exit(1);
  }
};
// Never let an undo clobber uncommitted work.
const stashDirty = () => {
  if (git(["status", "--porcelain", "--untracked-files=no"]).out) {
    log("==> Stashing uncommitted changes (recover with: git stash pop)");
    gitRun(["stash", "push", "-m", `harness-revert ${SHORT} safety stash`]);
  }
};

// Undo the session's promoted work. Two strategies:
//   default → `git revert` the promotion merge commit(s): keeps history, adds a
//             revert commit, SAFE even if other sessions landed on the same branch
//             afterwards (it only backs out THIS session's changes).
//   --hard  → `git reset --hard` to the session's fork point (session-base/<short>):
//             drops the session's commits ENTIRELY (clean history — no merge, no
//             revert commit), but ALSO drops anything else committed after the fork.
//             Use it when this session is the only thing on the branch (e.g. demos).
if (HARD) {
  // Resolve the fork anchor NOW, before the cleanup section deletes it below.
  const anchor = `session-base/${SHORT}`;
  const fork = git(["rev-parse", "--verify", `refs/heads/${anchor}`]);
  if (fork.code !== 0 || !fork.out) {
    err(
      `!! No fork anchor '${anchor}' — can't hard-reset. Run without --hard to revert instead.`,
    );
    process.exit(1);
  }
  const forkSha = fork.out;
  requireOnBase();
  if (git(["merge-base", "--is-ancestor", forkSha, "HEAD"]).code !== 0) {
    err(
      `!! ${anchor} (${forkSha.slice(0, 12)}) is not an ancestor of HEAD — history diverged, refusing to hard-reset. Use the default (revert) mode.`,
    );
    process.exit(1);
  }
  stashDirty();
  log(
    `==> Hard-resetting ${CURRENT_BRANCH} to ${anchor} (${forkSha.slice(0, 12)}) — the session disappears from history`,
  );
  const r = gitRun(["reset", "--hard", forkSha]);
  if (r.code !== 0) {
    err(`!! reset --hard failed: ${r.err}`);
    process.exit(1);
  }
} else {
  // Find this session's promotion merge commits on the base branch (newest first,
  // so reverting in order unwinds the stack cleanly).
  let merges = [];
  if (
    BASE_BRANCH &&
    git(["show-ref", "--verify", "--quiet", `refs/heads/${BASE_BRANCH}`])
      .code === 0
  ) {
    const subject = `merge(session): ${SHORT}`;
    merges = git(["log", "--merges", "--format=%H%x09%s", BASE_BRANCH])
      .out.split("\n")
      .filter(Boolean)
      .map((line) => line.split("\t"))
      .filter(([, subj]) => subj === subject)
      .map(([sha]) => sha);
  }
  if (merges.length === 0) {
    log(
      `==> No promotion merge found for session ${SHORT} — nothing to revert (cleanup only).`,
    );
  } else {
    requireOnBase();
    stashDirty();
    // All-or-nothing: capture HEAD before the first revert so that if a later
    // merge conflicts we can roll the already-applied reverts back. Otherwise a
    // partial run leaves some reverts committed while the original merges still
    // match the subject filter, and a naive "resolve and re-run" would re-revert
    // the already-reverted merges (revert-of-revert re-applies the session's
    // changes). Resetting to preRevertHead keeps re-run idempotent.
    const preRevertHead = DRY_RUN ? "" : git(["rev-parse", "HEAD"]).out;
    for (const sha of merges) {
      log(`==> Reverting promotion merge ${sha.slice(0, 12)}`);
      const r = gitRun(["revert", "--no-edit", "-m", "1", sha]);
      if (r.code !== 0) {
        gitRun(["revert", "--abort"]);
        if (!DRY_RUN && preRevertHead)
          gitRun(["reset", "--hard", preRevertHead]);
        err(
          `!! Revert hit a conflict on ${sha.slice(0, 12)} (another session may have touched the same files).`,
        );
        err(
          "   Rolled back to the pre-revert state — nothing was reverted or removed. Resolve the conflict source, then re-run.",
        );
        process.exit(1);
      }
    }
  }
}

// 3. Remove this session's worktrees (matched by their checked-out branch, since
//    the worktree path carries the full session id we don't have here).
const worktrees = [];
{
  const lines = git(["worktree", "list", "--porcelain"]).out.split("\n");
  let wt = "";
  for (const line of lines) {
    if (line.startsWith("worktree ")) wt = line.slice("worktree ".length);
    else if (line.startsWith("branch ")) {
      const br = line.slice("branch refs/heads/".length);
      if (br === `session/${SHORT}` || br.startsWith(`${SHORT}/`))
        worktrees.push(wt);
    }
  }
}
for (const wt of worktrees) {
  log(`==> Removing worktree ${wt}`);
  gitRun(["worktree", "remove", "--force", wt]);
}
gitRun(["worktree", "prune"]);

// 4. Delete this session's branches (task/simple, integration, fork anchor).
const branches = git([
  "for-each-ref",
  "--format=%(refname:short)",
  `refs/heads/${SHORT}/*`,
  `refs/heads/session/${SHORT}`,
  `refs/heads/session-base/${SHORT}`,
])
  .out.split("\n")
  .filter(Boolean);
for (const br of branches) {
  if (br === CURRENT_BRANCH) {
    log(`    ! skip current branch: ${br}`);
    continue;
  }
  log(`==> Deleting branch ${br}`);
  gitRun(["branch", "-D", br]);
}

// 5. Remove the fork-base config subsection.
log(`==> Removing config sessionbase.${SHORT}`);
gitRun(["config", "--local", "--remove-section", `sessionbase.${SHORT}`]);

// 6. Remove this session's /tmp dir(s). Worktree base is /tmp/<slug>/<full-id>;
//    the full id is <short>-<rest>, so match on the short id at the UUID-segment
//    boundary (exact, or followed by "-"). A bare startsWith(SHORT) would also
//    swallow another session whose id merely shares the leading hex block.
const slug = REPO_ROOT.replace(/\//g, "_");
const tmpBase = `/tmp/${slug}`;
if (existsSync(tmpBase)) {
  for (const name of readdirSync(tmpBase)) {
    if (name !== SHORT && !name.startsWith(`${SHORT}-`)) continue;
    const dir = join(tmpBase, name);
    log(`==> Removing session dir ${dir}`);
    if (DRY_RUN) log(`[dry-run] rm -rf ${dir}`);
    else rmSync(dir, { recursive: true, force: true });
  }
}

// NOTE: .promote.lock is intentionally left in place — it is shared across
// sessions and removing it could break a concurrent promotion's mutual exclusion.

log("==> Done.");
