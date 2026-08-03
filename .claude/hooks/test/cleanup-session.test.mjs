// Tests for cleanup-session.mjs: the SessionEnd hook that tears down this
// session's worktrees (_session, simple, TASK-XXX) under <WORKTREE_BASE> and
// removes the promotion lock + Playwright test-results. Builds a throwaway repo
// with real worktrees ("claude" Node project, real git/worktree work).

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "cleanup-session.mjs");
const SESSION_ID = "cafe1234-1111-2222-3333-444455556666";
const SHORT = SESSION_ID.split("-")[0];
const sanitize = (p) => p.replace(/\//g, "_");

let TMP = null;
afterEach(() => {
  if (TMP) rmSync(TMP, { recursive: true, force: true });
  TMP = null;
});

// A throwaway repo with a session branch + a _session and a simple worktree, plus
// the leftover files. Returns paths and a run() that fires the SessionEnd hook.
const setup = () => {
  TMP = mkdtempSync(join(tmpdir(), "cleanup-session-test-"));
  const app = join(TMP, "app");
  const tmpRoot = join(TMP, "wtroot");
  mkdirSync(app, { recursive: true });
  const base = join(tmpRoot, sanitize(app), SESSION_ID);
  mkdirSync(base, { recursive: true });

  const g = (...a) => spawnSync("git", ["-C", app, ...a], { encoding: "utf8" });
  g("init", "-q", "-b", "main");
  g("config", "user.email", "t@t.t");
  g("config", "user.name", "t");
  writeFileSync(join(app, "seed.txt"), "seed\n");
  g("add", ".");
  g("commit", "-qm", "seed");
  g("branch", `session/${SHORT}`, "main");
  g("branch", `${SHORT}/simple`, "main");
  g("worktree", "add", "-q", join(base, "_session"), `session/${SHORT}`);
  g("worktree", "add", "-q", join(base, "simple"), `${SHORT}/simple`);

  const promoteLock = join(app, ".promote.lock");
  const testResults = join(app, "test-results");
  writeFileSync(promoteLock, "");
  mkdirSync(testResults, { recursive: true });
  writeFileSync(join(testResults, ".last-run.json"), "{}");

  const env = { ...process.env, APP_DIR: app, HARNESS_TMP_ROOT: tmpRoot };
  delete env.CHAT_SESSION_DIR;
  const run = (extraEnv = {}) =>
    spawnSync("node", [HOOK], {
      input: JSON.stringify({ session_id: SESSION_ID }),
      env: { ...env, ...extraEnv },
      encoding: "utf8",
    });
  const worktreeList = () => g("worktree", "list", "--porcelain").stdout;
  return { app, base, promoteLock, testResults, run, worktreeList };
};

describe("cleanup-session", () => {
  test("removes the session worktrees, base dir and test-results", () => {
    const { base, testResults, run, worktreeList } = setup();
    const r = run();
    expect(r.status).toBe(0);
    expect(existsSync(base)).toBe(false);
    expect(existsSync(testResults)).toBe(false);
    // Only the main worktree remains registered.
    expect(worktreeList()).not.toContain("_session");
    expect(worktreeList()).not.toContain("/simple");
  });

  test("leaves the shared .promote.lock in place (concurrent-promotion mutex)", () => {
    const { promoteLock, run } = setup();
    run();
    expect(existsSync(promoteLock)).toBe(true);
  });

  test("removes only THIS session's rendered board, leaving other sessions'", () => {
    const { app, run } = setup();
    const mine = join(app, ".harness", SHORT);
    const other = join(app, ".harness", "beef9999");
    mkdirSync(mine, { recursive: true });
    mkdirSync(other, { recursive: true });
    writeFileSync(join(mine, "STATUS.md"), "# mine\n");
    writeFileSync(join(other, "STATUS.md"), "# other\n");
    run();
    expect(existsSync(mine)).toBe(false);
    expect(existsSync(other)).toBe(true);
  });

  test("leaves the main repo worktree intact", () => {
    const { app, run, worktreeList } = setup();
    run();
    expect(existsSync(join(app, "seed.txt"))).toBe(true);
    expect(worktreeList()).toContain(app);
  });

  test("preserves state for resume when a ticket is not yet merged (in-flight)", () => {
    const { base, run } = setup();
    writeFileSync(
      join(base, "TASK-001.json"),
      JSON.stringify({ id: "TASK-001", status: "planned" }),
    );
    const r = run();
    expect(r.status).toBe(0);
    // Teardown SKIPPED: the same session id must resume from disk later.
    expect(existsSync(base)).toBe(true);
    expect(existsSync(join(base, "TASK-001.json"))).toBe(true);
  });

  test("preserves state when the session branch has unpromoted commits", () => {
    const { base, run } = setup();
    const sessWt = join(base, "_session");
    writeFileSync(join(sessWt, "wave.txt"), "x\n");
    const gw = (...a) =>
      spawnSync("git", ["-C", sessWt, ...a], { encoding: "utf8" });
    gw("add", ".");
    gw("commit", "-qm", "wave work");
    const r = run();
    expect(r.status).toBe(0);
    expect(existsSync(base)).toBe(true);
  });

  test("is a no-op under a managed launcher (CHAT_SESSION_DIR set)", () => {
    const { base, promoteLock, run } = setup();
    const r = run({ CHAT_SESSION_DIR: "/tmp/managed-session-xyz" });
    expect(r.status).toBe(0);
    expect(existsSync(base)).toBe(true);
    expect(existsSync(promoteLock)).toBe(true);
  });
});
