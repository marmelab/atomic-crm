// Tests for bash-guard.mjs — browser rules (any caller) and validation-command rules (gated agents only). Blocks are decision JSON on stdout with exit 0; allowed commands produce no decision.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterAll, describe, test, expect } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "bash-guard.mjs");

const tmpRoot = mkdtempSync(join(tmpdir(), "bash-guard-tmp-"));

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

const runHook = (agent, command) => {
  const env = { ...process.env, CRM_TMP_ROOT: tmpRoot };
  delete env.CLAUDE_AGENT_NAME;
  const input = JSON.stringify({
    tool_name: "Bash",
    agent_type: agent,
    session_id: "test-1234",
    tool_input: { command },
  });
  return spawnSync("node", [HOOK], { input, env, encoding: "utf8" });
};

const isBlocked = (r) => r.stdout.includes('"decision":"block"');

describe("bash-guard hook", () => {
  describe("browser rules — any caller", () => {
    test("headed playwright test from main session → blocked", () => {
      const r = runHook("", "npx playwright test");
      expect(r.status).toBe(0);
      expect(isBlocked(r)).toBe(true);
      expect(r.stdout).toContain("--headless");
    });

    test("headed playwright screenshot from merger → blocked", () => {
      const r = runHook(
        "merger",
        "npx playwright screenshot http://localhost:5173 out.png",
      );
      expect(isBlocked(r)).toBe(true);
    });

    test("playwright with --headless from main session → allowed", () => {
      const r = runHook(
        "",
        "npx playwright screenshot --headless http://localhost:5173 out.png",
      );
      expect(r.status).toBe(0);
      expect(isBlocked(r)).toBe(false);
    });

    test("vite --open → blocked", () => {
      const r = runHook("", "npm run dev -- --open");
      expect(isBlocked(r)).toBe(true);
    });

    test("vite without --open → allowed", () => {
      const r = runHook("", "npm run dev");
      expect(isBlocked(r)).toBe(false);
    });
  });

  describe("validation rules — gated agents only", () => {
    const cases = [
      ["developer", "npm run typecheck"],
      ["developer", "npx tsc --noEmit"],
      ["developer", "npx vitest run"],
      ["developer", "npm run prettier:apply"],
      ["quality-reviewer", "npx playwright test --headless"],
      ["quality-reviewer", "make lint"],
      ["developer", "npm run build"],
    ];

    test.each(cases)("%s running '%s' → blocked", (agent, command) => {
      const r = runHook(agent, command);
      expect(r.status).toBe(0);
      expect(isBlocked(r)).toBe(true);
    });

    test("non-gated agent running validation command → allowed", () => {
      const r = runHook("merger", "npm run typecheck");
      expect(isBlocked(r)).toBe(false);
    });

    test("main session running validation command → allowed", () => {
      const r = runHook("", "npx vitest run");
      expect(isBlocked(r)).toBe(false);
    });

    test("gated agent running plain git command → allowed", () => {
      const r = runHook("developer", "git status && git log --oneline -3");
      expect(isBlocked(r)).toBe(false);
    });

    test("empty command → allowed", () => {
      const r = runHook("developer", "");
      expect(isBlocked(r)).toBe(false);
    });
  });
});
