// Tests for link-session-workspace.mjs: the SessionStart hook that keeps a
// stable ".harness-session" symlink in the VS Code multi-root workspace
// pointing at the current session dir (where the harness tickets live).

import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  lstatSync,
  readlinkSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, describe, test, expect } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "link-session-workspace.mjs");
const LINK_NAME = ".harness-session";
// Mirror lib/paths.mjs sanitizePath: every "/" becomes "_".
const sanitize = (p) => p.replace(/\//g, "_");

let TMP = null;
afterEach(() => {
  if (TMP) rmSync(TMP, { recursive: true, force: true });
  TMP = null;
});

// Build an isolated layout: <root>/ws/repo is the repo, <root>/ws holds the
// .code-workspace file (the workspace root), and <root>/sessions is the session
// dir root. run() spawns the hook with APP_DIR/HARNESS_TMP_ROOT pointing there.
const setup = ({ withWorkspaceFile = true } = {}) => {
  TMP = mkdtempSync(join(tmpdir(), "link-session-ws-test-"));
  const workspaceRoot = join(TMP, "ws");
  const repo = join(workspaceRoot, "repo");
  const tmpRoot = join(TMP, "sessions");
  mkdirSync(repo, { recursive: true });
  mkdirSync(tmpRoot, { recursive: true });
  if (withWorkspaceFile) {
    writeFileSync(join(workspaceRoot, "proj.code-workspace"), "{}");
  }
  const linkPath = join(workspaceRoot, LINK_NAME);
  const sessionDirFor = (id) => join(tmpRoot, sanitize(repo), id);
  const run = (sessionId, extraEnv = {}) => {
    const env = { ...process.env, APP_DIR: repo, HARNESS_TMP_ROOT: tmpRoot };
    delete env.CHAT_SESSION_DIR;
    delete env.CLAUDE_AGENT_NAME;
    Object.assign(env, extraEnv);
    return spawnSync("node", [HOOK], {
      input: JSON.stringify({ session_id: sessionId }),
      env,
      encoding: "utf8",
    });
  };
  return { workspaceRoot, repo, linkPath, sessionDirFor, run };
};

describe("link-session-workspace", () => {
  test("creates the symlink to the current session dir", () => {
    const { linkPath, sessionDirFor, run } = setup();
    const r = run("sess-1");
    expect(r.status).toBe(0);
    expect(lstatSync(linkPath).isSymbolicLink()).toBe(true);
    expect(readlinkSync(linkPath)).toBe(sessionDirFor("sess-1"));
    // target materialised so the link is never dangling
    expect(existsSync(sessionDirFor("sess-1"))).toBe(true);
  });

  test("repoints an existing harness symlink to the new session dir", () => {
    const { linkPath, sessionDirFor, run } = setup();
    run("sess-1");
    run("sess-2");
    expect(readlinkSync(linkPath)).toBe(sessionDirFor("sess-2"));
  });

  test("does nothing when there is no .code-workspace file", () => {
    const { linkPath, run } = setup({ withWorkspaceFile: false });
    const r = run("sess-1");
    expect(r.status).toBe(0);
    expect(existsSync(linkPath)).toBe(false);
  });

  test("does not clobber a real directory sitting at the link path", () => {
    const { linkPath, run } = setup();
    mkdirSync(linkPath);
    writeFileSync(join(linkPath, "keep.txt"), "important");
    run("sess-1");
    expect(lstatSync(linkPath).isSymbolicLink()).toBe(false);
    expect(existsSync(join(linkPath, "keep.txt"))).toBe(true);
  });

  test("is a no-op under a managed launcher (CHAT_SESSION_DIR set)", () => {
    const { linkPath, run } = setup();
    const r = run("sess-1", { CHAT_SESSION_DIR: "/tmp/managed-session-xyz" });
    expect(r.status).toBe(0);
    expect(existsSync(linkPath)).toBe(false);
  });
});
