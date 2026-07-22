// Tests for render-status.mjs: the SubagentStop hook that renders a portable
// harness board (STATUS.md / TICKETS.md / status.json) under <REPO>/.harness/<short>
// from the session's cheap state. Uses APP_DIR + HARNESS_TMP_ROOT so the hook
// reads a throwaway repo and a fake session dir, same pattern as the other tests.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "render-status.mjs");
const SESSION_ID = "cafe1234-1111-2222-3333-444455556666";
const SHORT = SESSION_ID.split("-")[0];
const sanitize = (p) => p.replace(/\//g, "_");

let TMP = null;
afterEach(() => {
  if (TMP) rmSync(TMP, { recursive: true, force: true });
  TMP = null;
});

// A throwaway repo + a fake session dir populated with the sources the hook reads:
// a technical progress log (the gate), two tickets, one review flag, one live
// worktree dir. `run()` fires the SubagentStop hook.
const setup = ({ withProgressLog = true } = {}) => {
  TMP = mkdtempSync(join(tmpdir(), "render-status-test-"));
  const app = join(TMP, "app");
  const tmpRoot = join(TMP, "wtroot");
  const base = join(tmpRoot, sanitize(app), SESSION_ID);
  mkdirSync(join(base, "tickets"), { recursive: true });
  mkdirSync(join(base, "reviews"), { recursive: true });
  mkdirSync(app, { recursive: true });

  if (withProgressLog) {
    writeFileSync(
      join(base, "harness-progress.log"),
      "12:00:01 plan ready (2 tickets)\n12:03:11 TASK-001 developer DONE\n12:05:42 TASK-001 merged\n",
    );
  }
  writeFileSync(
    join(base, "tickets", "TASK-001.json"),
    JSON.stringify({
      id: "TASK-001",
      title: "Rename the Add contact button",
      status: "merged",
      acceptance_criteria: ["button reads New contact"],
      files_to_modify: ["src/contacts/Button.tsx"],
      dependencies: [],
    }),
  );
  writeFileSync(
    join(base, "tickets", "TASK-002.json"),
    JSON.stringify({
      id: "TASK-002",
      title: "Add a Last activity column",
      status: "planned",
      acceptance_criteria: ["column visible", "sorted desc"],
      files_to_modify: ["src/contacts/List.tsx"],
      dependencies: ["TASK-001"],
    }),
  );
  // TASK-001 reviewed (flag present); TASK-002 still in flight (live worktree).
  writeFileSync(join(base, "reviews", "TASK-001-quality-reviewer"), "");
  mkdirSync(join(base, "TASK-002"), { recursive: true });

  const env = { ...process.env, APP_DIR: app, HARNESS_TMP_ROOT: tmpRoot };
  delete env.CHAT_SESSION_DIR;
  delete env.TICKETS_DIR;
  const run = (extraEnv = {}) =>
    spawnSync("node", [HOOK], {
      input: JSON.stringify({ session_id: SESSION_ID }),
      env: { ...env, ...extraEnv },
      encoding: "utf8",
    });
  const outDir = join(app, ".harness", SHORT);
  return { app, base, outDir, run };
};

describe("render-status", () => {
  test("renders STATUS.md with ticket table, verdict and live worktree", () => {
    const { outDir, run } = setup();
    const r = run();
    expect(r.status).toBe(0);
    const md = readFileSync(join(outDir, "STATUS.md"), "utf8");
    expect(md).toContain(SHORT);
    expect(md).toContain("1/2 merged");
    expect(md).toContain("TASK-001");
    expect(md).toContain("merged");
    expect(md).toContain("✅"); // TASK-001 review flag present
    expect(md).toContain("TASK-002");
    // TASK-002 has a live worktree dir → shown as in flight.
    expect(md).toContain("`TASK-002`");
    // The recent-activity block echoes the progress log.
    expect(md).toContain("TASK-001 merged");
  });

  test("renders TICKETS.md with full per-ticket detail", () => {
    const { outDir, run } = setup();
    run();
    const md = readFileSync(join(outDir, "TICKETS.md"), "utf8");
    expect(md).toContain("## TASK-002 · Add a Last activity column");
    expect(md).toContain("column visible");
    expect(md).toContain("src/contacts/List.tsx");
    expect(md).toContain("Depends on:** TASK-001");
  });

  test("writes status.json with correct counts and active tasks", () => {
    const { outDir, run } = setup();
    run();
    const s = JSON.parse(readFileSync(join(outDir, "status.json"), "utf8"));
    expect(s.short).toBe(SHORT);
    expect(s.tickets).toEqual({ total: 2, merged: 1, inProgress: 1 });
    expect(s.active).toEqual([{ task: "TASK-002" }]);
    expect(s.last).toContain("TASK-001 merged");
  });

  test("writes session.diff and a Changes section from the session branch", () => {
    const { app, outDir, run } = setup();
    // Turn the throwaway repo into a git repo with a session branch carrying one
    // change vs its fork anchor (session-base), like the harness topology.
    const g = (...a) =>
      spawnSync("git", ["-C", app, ...a], { encoding: "utf8" });
    g("init", "-q", "-b", "main");
    g("config", "user.email", "t@t.t");
    g("config", "user.name", "t");
    writeFileSync(join(app, "Button.tsx"), "label = 'Add contact'\n");
    g("add", ".");
    g("commit", "-qm", "base");
    g("branch", `session-base/${SHORT}`);
    g("checkout", "-q", "-b", `session/${SHORT}`);
    writeFileSync(join(app, "Button.tsx"), "label = 'New contact'\n");
    g("add", ".");
    g("commit", "-qm", "rename button");
    g("checkout", "-q", "main");

    run();
    const patch = readFileSync(join(outDir, "session.diff"), "utf8");
    expect(patch).toContain("Button.tsx");
    expect(patch).toContain("+label = 'New contact'");
    expect(patch).toContain("-label = 'Add contact'");
    const md = readFileSync(join(outDir, "STATUS.md"), "utf8");
    expect(md).toContain("## Changes");
    expect(md).toContain("Button.tsx");
  });

  test("includes in-flight dev-branch work before it is merged", () => {
    const { app, outDir, run } = setup();
    const g = (...a) =>
      spawnSync("git", ["-C", app, ...a], { encoding: "utf8" });
    g("init", "-q", "-b", "main");
    g("config", "user.email", "t@t.t");
    g("config", "user.name", "t");
    writeFileSync(join(app, "List.tsx"), "no filter\n");
    g("add", ".");
    g("commit", "-qm", "base");
    g("branch", `session-base/${SHORT}`);
    g("branch", `session/${SHORT}`); // session branch at fork, nothing merged yet
    // developer's in-flight branch, committed but NOT merged into the session
    g("checkout", "-q", "-b", `${SHORT}/TASK-001`);
    writeFileSync(join(app, "List.tsx"), "without-email filter\n");
    g("add", ".");
    g("commit", "-qm", "wip");
    g("checkout", "-q", "main");

    run();
    const patch = readFileSync(join(outDir, "session.diff"), "utf8");
    expect(patch).toContain(`in flight: ${SHORT}/TASK-001`);
    expect(patch).toContain("+without-email filter");
  });

  test("omits session.diff when there is no git session branch", () => {
    const { outDir, run } = setup();
    run();
    expect(existsSync(join(outDir, "session.diff"))).toBe(false);
    const md = readFileSync(join(outDir, "STATUS.md"), "utf8");
    expect(md).toContain("no changes yet");
  });

  test("is inert when there is no technical progress log", () => {
    const { app, run } = setup({ withProgressLog: false });
    const r = run();
    expect(r.status).toBe(0);
    expect(existsSync(join(app, ".harness"))).toBe(false);
  });

  test("is a no-op under a managed launcher (CHAT_SESSION_DIR set)", () => {
    const { app, run } = setup();
    const r = run({ CHAT_SESSION_DIR: "/tmp/managed-session-xyz" });
    expect(r.status).toBe(0);
    expect(existsSync(join(app, ".harness"))).toBe(false);
  });
});
