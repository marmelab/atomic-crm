// Tests for harness-revert.mjs --hard collateral guard: `reset --hard` to the
// session fork point must NOT silently drop commits that are not part of the
// session (e.g. the user's own commits made on the base branch after the fork).

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "..", "harness-revert.mjs");
const SHORT = "beef1234";

let TMP = null;
afterEach(() => {
  if (TMP) rmSync(TMP, { recursive: true, force: true });
  TMP = null;
});

// A repo forked at `base`, a session branch with one change, and one UNRELATED
// commit on main made AFTER the fork (the collateral --hard would drop).
const setup = () => {
  TMP = mkdtempSync(join(tmpdir(), "harness-revert-test-"));
  const app = join(TMP, "app");
  const g = (...a) => spawnSync("git", ["-C", app, ...a], { encoding: "utf8" });
  spawnSync("git", ["init", "-q", "-b", "main", app]);
  g("config", "user.email", "t@t.t");
  g("config", "user.name", "t");
  writeFileSync(join(app, "file.txt"), "base\n");
  g("add", ".");
  g("commit", "-qm", "base");
  const forkSha = g("rev-parse", "HEAD").stdout.trim();
  g("branch", `session-base/${SHORT}`);
  g("branch", `session/${SHORT}`);
  // session work lands on the session branch (never merged to main here)
  g("checkout", "-q", `session/${SHORT}`);
  writeFileSync(join(app, "file.txt"), "session change\n");
  g("add", ".");
  g("commit", "-qm", "session work");
  g("checkout", "-q", "main");
  // the user's unrelated commit on main, AFTER the fork
  writeFileSync(join(app, "unrelated.txt"), "my own work\n");
  g("add", ".");
  g("commit", "-qm", "unrelated commit");
  g("config", "--local", `sessionbase.${SHORT}.branch`, "main");

  const head = () => g("rev-parse", "HEAD").stdout.trim();
  const run = (...args) =>
    spawnSync("node", [SCRIPT, SHORT, ...args], { cwd: app, encoding: "utf8" });
  return { app, forkSha, head, run };
};

describe("harness-revert --hard collateral guard", () => {
  test("refuses --hard when it would drop non-session commits", () => {
    const { head, run } = setup();
    const before = head();
    const r = run("--hard");
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/NOT part of session/);
    expect(r.stderr).toContain("unrelated commit");
    // HEAD untouched — nothing was reset.
    expect(head()).toBe(before);
  });

  test("--force lets --hard reset to the fork point", () => {
    const { forkSha, head, run } = setup();
    const r = run("--hard", "--force");
    expect(r.status).toBe(0);
    expect(head()).toBe(forkSha);
  });
});
