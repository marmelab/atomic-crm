// Tests for circuit-breaker.mjs — per-subagent Bash counter. Blocks are decision
// JSON on stdout with exit 0; the main session (no agent_id) is never throttled.

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
const runHook = (agentId, sessionId = "cb-1234") => {
  const env = { ...process.env, CRM_TMP_ROOT: tmpRoot, APP_DIR: appDir };
  delete env.CLAUDE_AGENT_NAME;
  const payload = {
    tool_name: "Bash",
    session_id: sessionId,
    tool_input: { command: "ls" },
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
    for (let i = 0; i < 60; i++) last = runHook("");
    expect(last.status).toBe(0);
    expect(isBlocked(last)).toBe(false);
  });

  test("subagent is blocked once it exceeds the iteration limit", () => {
    let r;
    for (let i = 1; i <= 45; i++) r = runHook("agent-loop");
    expect(isBlocked(r)).toBe(false); // 45th call still allowed
    const blocked = runHook("agent-loop"); // 46th
    expect(blocked.status).toBe(0);
    expect(isBlocked(blocked)).toBe(true);
    expect(blocked.stdout).toContain("stuck in a loop");
  });

  test("each subagent has an independent budget", () => {
    for (let i = 1; i <= 46; i++) runHook("agent-busy");
    const otherAgent = runHook("agent-fresh");
    expect(isBlocked(otherAgent)).toBe(false);
  });
});
