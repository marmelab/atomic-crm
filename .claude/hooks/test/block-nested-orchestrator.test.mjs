// Tests for block-nested-orchestrator.mjs — the PreToolUse(Agent) gate that
// enforces the harness dispatch topology. Two rules:
//   1. the orchestrator may dispatch ONLY the typed harness agents
//      (planner, developer, quality-reviewer, merger, documentator).
//   2. a subagent (has agent_id) must NOT dispatch an orchestrator.
// A block is emitted via decisionBlock: exit 0 with {"decision":"block"} on
// stdout. An allowed dispatch exits 0 with no decision JSON.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterAll, describe, test, expect } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "block-nested-orchestrator.mjs");
const TMP = mkdtempSync(join(tmpdir(), "block-nested-orch-test-"));
const env = { ...process.env, APP_DIR: TMP, CRM_TMP_ROOT: TMP };
delete env.CLAUDE_AGENT_NAME;

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

// callerType = the dispatching agent's agent_type; agentId distinguishes the
// main thread ("") from a subagent (non-empty).
const run = (callerType, target, agentId = "") => {
  const r = spawnSync("node", [HOOK], {
    input: JSON.stringify({
      session_id: "td-nested-1",
      agent_type: callerType,
      agent_id: agentId,
      tool_input: { subagent_type: target },
    }),
    env,
    encoding: "utf8",
  });
  return {
    blocked: /"decision":"block"/.test(r.stdout || ""),
    status: r.status,
  };
};

describe("block-nested-orchestrator — Rule 1 (orchestrator allowlist)", () => {
  for (const t of [
    "planner",
    "developer",
    "quality-reviewer",
    "merger",
    "documentator",
  ]) {
    test(`orchestrator dispatching ${t} → allowed`, () => {
      expect(run("orchestrator", t, "orch-1").blocked).toBe(false);
    });
  }

  test("orchestrator dispatching general-purpose → blocked", () => {
    expect(run("orchestrator", "general-purpose", "orch-1").blocked).toBe(true);
  });

  test("orchestrator dispatching another orchestrator → blocked", () => {
    expect(run("orchestrator", "orchestrator", "orch-1").blocked).toBe(true);
  });

  test("a suffixed orchestrator-name caller is still gated by the allowlist", () => {
    expect(run("orchestrator-abc12", "Explore", "orch-1").blocked).toBe(true);
    expect(run("orchestrator-abc12", "planner", "orch-1").blocked).toBe(false);
  });

  test("chat-orchestrator dispatching planner → allowed", () => {
    expect(run("chat-orchestrator", "planner", "chat-1").blocked).toBe(false);
  });
});

describe("block-nested-orchestrator — Rule 2 (no nested orchestrator)", () => {
  test("a subagent dispatching orchestrator → blocked", () => {
    expect(run("general-purpose", "orchestrator", "gp-1").blocked).toBe(true);
  });

  test("a subagent dispatching chat-orchestrator → blocked", () => {
    expect(run("developer", "chat-orchestrator", "dev-1").blocked).toBe(true);
  });

  test("the main thread (no agent_id) dispatching orchestrator → allowed", () => {
    expect(run("", "orchestrator", "").blocked).toBe(false);
  });

  test("a subagent dispatching a non-orchestrator agent → allowed", () => {
    expect(run("developer", "general-purpose", "dev-1").blocked).toBe(false);
  });
});
