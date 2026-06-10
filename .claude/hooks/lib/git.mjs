// Git repo and worktree state queries.

import { REPO } from "./paths.mjs";
import { exec } from "./process.mjs";

export function git(args = [], opts = {}) {
  return exec("git", ["-C", REPO, ...args], opts);
}

export function getBaseBranch() {
  const r = git(["symbolic-ref", "--short", "HEAD"]);
  return (r.status === 0 ? r.stdout.trim() : "") || "main";
}

const WORKTREE_PREFIX = "worktree ";
const BRANCH_PREFIX = "branch refs/heads/";

// Value of the first line carrying `prefix`, stripped of it; "" when absent.
const lineValue = (lines, prefix) => {
  const line = lines.find((l) => l.startsWith(prefix));
  return line ? line.slice(prefix.length) : "";
};

// `--porcelain` emits one blank-line-separated block per worktree, each opening
// with a `worktree <path>` line and (unless detached/bare) a `branch refs/...`
// line. Parse each block independently; drop blocks with no path (trailing blank).
export function getWorktreeEntries() {
  return git(["worktree", "list", "--porcelain"]).stdout
    .split("\n\n")
    .map((block) => block.split("\n"))
    .map((lines) => ({
      path: lineValue(lines, WORKTREE_PREFIX),
      branch: lineValue(lines, BRANCH_PREFIX),
    }))
    .filter((entry) => entry.path);
}

export const getWorktreePaths = () => getWorktreeEntries().map((e) => e.path);

export function isWorktreeDirty(wt, base) {
  const changed = exec("git", ["-C", wt, "status", "--porcelain"]).stdout.trim();
  const ahead = exec("git", ["-C", wt, "log", "--oneline", `${base}..HEAD`]).stdout.trim();
  return Boolean(changed || ahead);
}

export function getWorktreeChangedFiles(wt, base) {
  const nonEmpty = (lines) => lines.split("\n").filter((l) => l.trim());
  const statusPath = (line) => line.trim().split(/\s+/).pop();
  const committed = exec("git", ["-C", wt, "diff", "--name-only", `${base}..HEAD`]).stdout;
  const working = exec("git", ["-C", wt, "status", "--porcelain"]).stdout;
  return [
    ...new Set([...nonEmpty(committed).map((l) => l.trim()), ...nonEmpty(working).map(statusPath)]),
  ];
}
