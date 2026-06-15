// Tests for member-idle-gate.mjs — gates quality-reviewer-*, test-validator-* and
// merger-* until the developer's "ready" flag exists. Blocks are exit 2 + stderr
// (ctx.fail); passes are exit 0. Flags live under <sessionDir>/flags, where
// sessionDir = <CRM_TMP_ROOT>/<sanitized APP_DIR>/<session_id>.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterAll, beforeEach, describe, test, expect } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "member-idle-gate.mjs");

const tmpRoot = mkdtempSync(join(tmpdir(), "idle-gate-tmp-"));
const appDir = mkdtempSync(join(tmpdir(), "idle-gate-app-"));
const SESSION = "idle-1234";

const sanitize = (p) => p.replace(/\//g, "_");
const flagsDir = join(tmpRoot, sanitize(appDir), SESSION, "flags");

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  rmSync(appDir, { recursive: true, force: true });
});

beforeEach(() => {
  rmSync(flagsDir, { recursive: true, force: true });
});

const writeFlag = (name) => {
  mkdirSync(flagsDir, { recursive: true });
  writeFileSync(join(flagsDir, name), "");
};

const runHook = (
  agentType,
  toolName = "Read",
  toolInput = { file_path: "/x" },
) => {
  const env = { ...process.env, CRM_TMP_ROOT: tmpRoot, APP_DIR: appDir };
  delete env.CLAUDE_AGENT_NAME;
  const payload = {
    tool_name: toolName,
    agent_type: agentType,
    session_id: SESSION,
    tool_input: toolInput,
  };
  return spawnSync("node", [HOOK], {
    input: JSON.stringify(payload),
    env,
    encoding: "utf8",
  });
};

describe("member-idle-gate hook", () => {
  test("quality-reviewer without its flag is blocked", () => {
    const r = runHook("quality-reviewer-TASK-007");
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("notified-qr-TASK-007");
  });

  test("quality-reviewer with its flag is allowed", () => {
    writeFlag("notified-qr-TASK-007");
    const r = runHook("quality-reviewer-TASK-007");
    expect(r.status).toBe(0);
  });

  test("test-validator without its flag is blocked", () => {
    const r = runHook("test-validator-TASK-008");
    expect(r.status).toBe(2);
  });

  test("test-validator with its flag is allowed", () => {
    writeFlag("notified-tv-TASK-008");
    const r = runHook("test-validator-TASK-008");
    expect(r.status).toBe(0);
  });

  test("merger with its task flag is allowed", () => {
    writeFlag("notified-merger-TASK-009");
    const r = runHook("merger-TASK-009", "Bash", { command: "git merge" });
    expect(r.status).toBe(0);
  });

  test("non-reviewer agent (developer) passes through immediately", () => {
    const r = runHook("developer-TASK-007", "Bash", { command: "ls" });
    expect(r.status).toBe(0);
  });

  test("main session (no agent_type) passes through", () => {
    const r = runHook("", "Bash", { command: "ls" });
    expect(r.status).toBe(0);
  });

  test("reviewer with no resolvable TASK_ID is blocked conservatively", () => {
    const r = runHook("quality-reviewer", "Bash", { command: "ls" });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("TASK_ID");
  });
});
