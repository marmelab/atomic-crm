// Tests for circuit-breaker.mjs - per-subagent WORK-call counter. Blocks are decision
// JSON on stdout with exit 0; the main session (no agent_id) is never throttled.
// Read-only exploration and git plumbing/commit are "free" (never counted).

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterAll, describe, test, expect } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "circuit-breaker.mjs");

const tmpRoot = mkdtempSync(join(tmpdir(), "circuit-breaker-tmp-"));
const appDir = mkdtempSync(join(tmpdir(), "circuit-breaker-app-"));

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  rmSync(appDir, { recursive: true, force: true });
});

// agentId controls the per-subagent counter file; vary it per test for isolation.
// `command` decides whether the call counts: a WORK command counts, a free one does not.
const WORK = "node work.mjs";
const runHook = (agentId, command = WORK, sessionId = "cb-1234") => {
  const env = { ...process.env, CRM_TMP_ROOT: tmpRoot, APP_DIR: appDir };
  delete env.CLAUDE_AGENT_NAME;
  const payload = {
    tool_name: "Bash",
    session_id: sessionId,
    tool_input: { command },
  };
  if (agentId) payload.agent_id = agentId;
  return spawnSync("node", [HOOK], {
    input: JSON.stringify(payload),
    env,
    encoding: "utf8",
  });
};

const isBlocked = (r) => r.stdout.includes('"decision":"block"');

describe("circuit-breaker hook", () => {
  test("main session (no agent_id) is never throttled", () => {
    let last;
    for (let i = 0; i < 60; i++) last = runHook("", WORK);
    expect(last.status).toBe(0);
    expect(isBlocked(last)).toBe(false);
  });

  test("subagent is blocked once its WORK calls exceed the iteration limit", () => {
    let r;
    for (let i = 1; i <= 45; i++) r = runHook("agent-loop", WORK);
    expect(isBlocked(r)).toBe(false); // 45th work call still allowed
    const blocked = runHook("agent-loop", WORK); // 46th
    expect(blocked.status).toBe(0);
    expect(isBlocked(blocked)).toBe(true);
    expect(blocked.stdout).toContain("stuck in a loop");
  });

  test("each subagent has an independent budget", () => {
    for (let i = 1; i <= 46; i++) runHook("agent-busy", WORK);
    const otherAgent = runHook("agent-fresh", WORK);
    expect(isBlocked(otherAgent)).toBe(false);
  });

  test("read-only search (grep/find/ls/cat) is free - never counted", () => {
    let last;
    for (const cmd of [
      "grep -rn Foo src",
      "find . -name x",
      "ls -la",
      "cat pkg.json",
      "wc -l f",
    ]) {
      for (let i = 0; i < 20; i++) last = runHook("agent-explore", cmd);
    }
    expect(isBlocked(last)).toBe(false); // 100 read-only calls, still not blocked
  });

  test("git add/commit/status is free - the final commit is never starved", () => {
    let last;
    for (let i = 0; i < 60; i++)
      last = runHook("agent-commit", 'git commit -m "feat(TASK-001): x"');
    expect(isBlocked(last)).toBe(false);
  });

  test("a `cd <worktree> &&` prefix is stripped before classifying", () => {
    // free command behind a cd prefix stays free
    let free;
    for (let i = 0; i < 60; i++)
      free = runHook("agent-cd-free", "cd /tmp/wt && grep -rn Foo src");
    expect(isBlocked(free)).toBe(false);
    // work command behind a cd prefix still counts
    let work;
    for (let i = 1; i <= 46; i++)
      work = runHook("agent-cd-work", "cd /tmp/wt && node work.mjs");
    expect(isBlocked(work)).toBe(true);
  });

  test("free calls do not consume the work budget (mixed workload)", () => {
    // 100 greps then 45 work calls on the same agent: still under the limit.
    for (let i = 0; i < 100; i++) runHook("agent-mixed", "grep -rn Foo src");
    let r;
    for (let i = 1; i <= 45; i++) r = runHook("agent-mixed", WORK);
    expect(isBlocked(r)).toBe(false); // greps did not eat the budget
    const blocked = runHook("agent-mixed", WORK); // 46th work call
    expect(isBlocked(blocked)).toBe(true);
  });
});
