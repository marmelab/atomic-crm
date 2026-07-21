// Worktree teardown primitives shared by the cleanup hooks (cleanup-worktree,
// cleanup-session). Mutations live here, kept separate from git.mjs's read-only
// queries. The harness-revert script reuses getWorktreeEntries (read) directly
// but keeps its own mutations because it honours --dry-run.

import { rmSync } from "node:fs";
import { getWorktreeEntries, git } from "./git.mjs";

// Remove one worktree: `git worktree remove --force`, falling back to a plain
// recursive rm when git refuses (e.g. the admin entry is already gone). Callers
// prune afterwards (removeWorktreesUnder does; a lone caller should too).
export function removeWorktree(path) {
  if (git(["worktree", "remove", "--force", path]).status !== 0) {
    rmSync(path, { recursive: true, force: true });
  }
}

// Remove every registered worktree at or under `base`, then prune the admin
// refs. Returns the count removed. The main repo worktree is never under a
// session base, so it is excluded naturally.
export function removeWorktreesUnder(base) {
  const under = getWorktreeEntries().filter(
    (e) => e.path === base || e.path.startsWith(base + "/"),
  );
  under.forEach((e) => removeWorktree(e.path));
  git(["worktree", "prune"]);
  return under.length;
}
