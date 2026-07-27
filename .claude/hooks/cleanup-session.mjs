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
// Resume guard: if the session is still mid-harness at end (plan gate, mid-wave,
// awaiting promotion, or a pending deploy migration), teardown is SKIPPED so the
// same session id can resume from disk later (STATE RECOVERY). Only a finished /
// idle session is torn down. See lib/session-state.mjs.
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
import { detectInflight } from "./lib/session-state.mjs";
import { removeWorktreeFolders } from "./lib/workspace-folders.mjs";

if (process.env.CHAT_SESSION_DIR) process.exit(0);

let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {
  process.exit(0);
}
const ctx = createHookContext(raw, "cleanup-session");

// Resume safety: if THIS session is mid-harness (plan gate, mid-wave, awaiting
// promotion, or a pending deploy migration), a clean SessionEnd must NOT destroy
// its state - the same session id resumes later and STATE RECOVERY needs the
// tickets and partial worktrees on disk. Preserve everything and bail. `null`
// (undetermined) also preserves: never delete resumable work on a probe error.
// Keyed on this session's own namespace, so a concurrent session is unaffected.
try {
  const { inflight, phase } = detectInflight(ctx);
  if (inflight !== false) {
    ctx.error(
      `preserved for resume (phase=${phase ?? "undetermined"}); state kept for STATE RECOVERY`,
    );
    process.exit(0);
  }
} catch {
  // Detection failed entirely: fail safe (preserve), do not risk deleting work.
  process.exit(0);
}

try {
  // All worktrees under this session's base (_session, simple, leftover TASK-XXX)
  // + prune, then the base dir itself (worktrees, tickets, logs; scratch once the
  // session ends). Base removal is last: nothing may log after it (this hook's log
  // file lives inside it and logging would recreate it).
  removeWorktreesUnder(ctx.worktreeBase);
  // Drop this session's worktree folders from the editor workspace (setup-worktree
  // added them on a technical run). Path prefix match on the session's worktree
  // base, so a concurrent session's folders stay intact.
  removeWorktreeFolders(
    ctx.repo,
    (p) => p === ctx.worktreeBase || p.startsWith(ctx.worktreeBase + "/"),
  );
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
