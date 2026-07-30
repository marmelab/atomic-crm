// Show a harness worktree in the editor by adding it as a workspace folder, so
// its files AND its Source Control diff appear live during a run. Two mechanisms,
// auto-detected:
//
//   - A `.code-workspace` file beside the repo (multi-root workspace): edit its
//     `folders` array. VS Code live-reloads the file, so add AND remove are clean.
//   - A mono-folder window (no `.code-workspace`): `code --add <path>` asks the
//     running VS Code window to add the folder (which turns it into an untitled
//     multi-root workspace). There is no `code --remove` in the VS Code CLI, so
//     removal is a no-op here; the untitled workspace is not persisted, so the
//     entry is gone on the next fresh open anyway.
//
// Every function is best-effort and never throws: a convenience view must not
// break a run. A parse failure leaves the file untouched (never corrupt it).

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { exec } from "./process.mjs";

// The `.code-workspace` file beside the repo (the multi-root workspace root is
// dirname(repo)). Returns its absolute path, or null (mono-folder / none).
export function workspaceFile(repo) {
  const root = dirname(repo);
  try {
    const name = readdirSync(root).find((n) => n.endsWith(".code-workspace"));
    return name ? join(root, name) : null;
  } catch {
    return null;
  }
}

function readWorkspace(file) {
  try {
    const ws = JSON.parse(readFileSync(file, "utf8"));
    return ws && Array.isArray(ws.folders) ? ws : null;
  } catch {
    return null; // JSONC/comments or unreadable — do not touch it
  }
}

function writeWorkspace(file, ws) {
  try {
    writeFileSync(file, JSON.stringify(ws, null, 2) + "\n");
    return true;
  } catch {
    return false;
  }
}

// A VS Code window is reachable from a hook subprocess (its IPC env is present).
const canDriveWindow = () =>
  Boolean(process.env.VSCODE_IPC_HOOK_CLI || process.env.REMOTE_CONTAINERS_IPC);

/**
 * Add `path` (an absolute worktree path) as a workspace folder named `name`.
 * @returns {boolean} whether the folder was added (or already present).
 */
export function addWorktreeFolder(repo, path, name) {
  if (!existsSync(path)) return false;
  const file = workspaceFile(repo);
  if (file) {
    const ws = readWorkspace(file);
    if (!ws) return false;
    if (ws.folders.some((f) => f.path === path)) return true; // idempotent
    ws.folders.push({ path, name });
    return writeWorkspace(file, ws);
  }
  // Mono-folder window: ask VS Code to add it (add-only, self-heals on reopen).
  if (canDriveWindow()) return exec("code", ["--add", path]).status === 0;
  return false;
}

/**
 * Remove every workspace folder whose absolute path satisfies `matches(path)`
 * (e.g. a prefix match on the session's worktree base, or an exact path). Only
 * the `.code-workspace` mechanism supports removal; mono-folder is a no-op.
 * @returns {boolean} whether anything was removed.
 */
export function removeWorktreeFolders(repo, matches) {
  const file = workspaceFile(repo);
  if (!file) return false;
  const ws = readWorkspace(file);
  if (!ws) return false;
  const kept = ws.folders.filter((f) => !(f.path && matches(f.path)));
  if (kept.length === ws.folders.length) return false;
  ws.folders = kept;
  return writeWorkspace(file, ws);
}
