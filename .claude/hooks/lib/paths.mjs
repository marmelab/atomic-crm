import { realpathSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { exec } from "./process.mjs";

// APP_DIR / CLAUDE_PROJECT_DIR override the detected root (used by hook tests).
function getRepo() {
  if (process.env.APP_DIR) return process.env.APP_DIR;
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  const top = exec("git", ["rev-parse", "--show-toplevel"]);
  if (top.status === 0 && top.stdout.trim()) return top.stdout.trim();
  return process.cwd();
}

export const REPO = getRepo();

export const CONFIG_DIR =
  process.env.CLAUDE_CONFIG_DIR || join(process.env.HOME || "/root", ".claude");
// HARNESS_TMP_ROOT is the neutral name; CRM_TMP_ROOT is the deprecated fallback
// kept for one release so existing launchers / tests keep working.
export const TMP_ROOT =
  process.env.HARNESS_TMP_ROOT || process.env.CRM_TMP_ROOT || "/tmp";

export function sanitizePath(p) {
  return String(p ?? "").replace(/\//g, "_");
}

// Resolve symlinks in the deepest existing ancestor of `p` (which may not exist
// yet). Git records worktree paths canonicalized, so on macOS a `/tmp/...` or
// `/var/folders/...` base must become `/private/...` to match `git worktree list`.
export function canonicalPath(p) {
  try {
    return realpathSync(p);
  } catch {
    const parent = dirname(p);
    return parent === p ? p : join(canonicalPath(parent), basename(p));
  }
}
