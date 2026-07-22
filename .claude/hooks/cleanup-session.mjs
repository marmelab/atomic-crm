#!/usr/bin/env node
// SessionEnd: tear down THIS session's harness scratch state when the Claude
// session ends: remove every git worktree under <WORKTREE_BASE> (_session,
// simple, any leftover TASK-XXX), prune the admin refs, drop the base dir, and
// remove the Playwright test-results left in the repo.
//
// Branches are left intact: they are cheap, do not clutter the editor's Source
// Control view (only worktrees do), and deleting them could drop work stopped at
// the session branch and not yet promoted.
//
// `.promote.lock` is deliberately NOT removed: it is the shared promotion mutex
// (flock), and unlinking it mid-run would break a concurrent session's mutual
// exclusion (same reasoning as harness-revert.mjs). It is gitignored, so it does
// not show as untracked either way.
//
// Only the CURRENT session's paths are touched, never another session's (a
// second VS Code window is its own session and may be running concurrently).
// No-op under a managed launcher (CHAT_SESSION_DIR owns its own lifecycle).
// Never throws. No file logging: this hook's log file lives inside the base dir
// it deletes, so writing after removal would recreate the dir we tear down.

import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createHookContext } from "./lib/context.mjs";
import { REPO } from "./lib/paths.mjs";
import { removeWorktreesUnder } from "./lib/worktree.mjs";

if (process.env.CHAT_SESSION_DIR) process.exit(0);

let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {
  process.exit(0);
}
const ctx = createHookContext(raw, "cleanup-session");

try {
  // All worktrees under this session's base (_session, simple, leftover TASK-XXX)
  // + prune, then the base dir itself (worktrees, tickets, logs; scratch once the
  // session ends). Base removal is last: nothing may log after it (this hook's log
  // file lives inside it and logging would recreate it).
  removeWorktreesUnder(ctx.worktreeBase);
  rmSync(join(REPO, "test-results"), { recursive: true, force: true });
  // This session's rendered board only (render-status.mjs). Per-session subdir,
  // so a concurrent session's board under .harness/<other-short> is left intact.
  rmSync(join(REPO, ".harness", ctx.sessionShort), {
    recursive: true,
    force: true,
  });
  rmSync(ctx.worktreeBase, { recursive: true, force: true });
} catch (e) {
  ctx.error(`skipped: ${e?.message ?? e}`);
}

process.exit(0);
