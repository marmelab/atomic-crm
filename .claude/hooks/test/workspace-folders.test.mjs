// Tests for workspace-folders.mjs: adding/removing a harness worktree as a VS Code
// workspace folder. Exercises the `.code-workspace` file mechanism (clean add +
// remove) and the mono-folder no-op path. IPC env is cleared in beforeEach so the
// mono path can never shell out to `code --add` against a real window during tests.

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  addWorktreeFolder,
  removeWorktreeFolders,
} from "../lib/workspace-folders.mjs";

let TMP = null;
let saved = {};
beforeEach(() => {
  saved = {
    ipc: process.env.VSCODE_IPC_HOOK_CLI,
    rc: process.env.REMOTE_CONTAINERS_IPC,
  };
  delete process.env.VSCODE_IPC_HOOK_CLI;
  delete process.env.REMOTE_CONTAINERS_IPC;
});
afterEach(() => {
  if (saved.ipc !== undefined) process.env.VSCODE_IPC_HOOK_CLI = saved.ipc;
  if (saved.rc !== undefined) process.env.REMOTE_CONTAINERS_IPC = saved.rc;
  if (TMP) rmSync(TMP, { recursive: true, force: true });
  TMP = null;
});

// A workspace root containing the repo folder `app` and (optionally) a
// `.code-workspace` file beside it, plus a worktree dir living outside the repo.
const setup = ({ withWorkspaceFile = true } = {}) => {
  TMP = mkdtempSync(join(tmpdir(), "workspace-folders-test-"));
  const root = join(TMP, "root");
  const repo = join(root, "app");
  mkdirSync(repo, { recursive: true });
  const wsFile = join(root, "proj.code-workspace");
  if (withWorkspaceFile) {
    writeFileSync(
      wsFile,
      JSON.stringify({ folders: [{ path: "app", name: "app" }] }, null, 2),
    );
  }
  const wt = join(TMP, "wt", "TASK-001");
  mkdirSync(wt, { recursive: true });
  const folders = () => JSON.parse(readFileSync(wsFile, "utf8")).folders;
  return { repo, wt, wsFile, folders };
};

describe("workspace-folders", () => {
  test("adds a worktree folder to the .code-workspace", () => {
    const { repo, wt, folders } = setup();
    expect(addWorktreeFolder(repo, wt, "🎫 TASK-001")).toBe(true);
    const f = folders();
    expect(f).toContainEqual({ path: wt, name: "🎫 TASK-001" });
    // the original repo folder is preserved
    expect(f).toContainEqual({ path: "app", name: "app" });
  });

  test("is idempotent (no duplicate entry)", () => {
    const { repo, wt, folders } = setup();
    addWorktreeFolder(repo, wt, "🎫 TASK-001");
    addWorktreeFolder(repo, wt, "🎫 TASK-001");
    expect(folders().filter((f) => f.path === wt)).toHaveLength(1);
  });

  test("removeWorktreeFolders removes entries matching the predicate", () => {
    const { repo, wt, folders } = setup();
    addWorktreeFolder(repo, wt, "🎫 TASK-001");
    expect(removeWorktreeFolders(repo, (p) => p === wt)).toBe(true);
    expect(folders().some((f) => f.path === wt)).toBe(false);
    // the original repo folder survives
    expect(folders()).toContainEqual({ path: "app", name: "app" });
  });

  test("does not add a non-existent worktree path", () => {
    const { repo, folders } = setup();
    expect(addWorktreeFolder(repo, join(TMP, "nope"), "x")).toBe(false);
    expect(folders()).toHaveLength(1);
  });

  test("never corrupts a .code-workspace it cannot parse (JSONC)", () => {
    const { repo, wt, wsFile } = setup();
    const withComment = '// my workspace\n{ "folders": [{ "path": "app" }] }\n';
    writeFileSync(wsFile, withComment);
    expect(addWorktreeFolder(repo, wt, "x")).toBe(false);
    expect(readFileSync(wsFile, "utf8")).toBe(withComment);
  });

  test("mono-folder with no IPC: add and remove are no-ops", () => {
    const { repo, wt } = setup({ withWorkspaceFile: false });
    expect(addWorktreeFolder(repo, wt, "x")).toBe(false);
    expect(removeWorktreeFolders(repo, () => true)).toBe(false);
  });
});
