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

  describe("guard-state rule — orchestrator only", () => {
    const SD = "/tmp/_repo/sess-1234";

    test("orchestrator touches a review flag → blocked", () => {
      const r = runHook(
        "orchestrator",
        `touch ${SD}/reviews/TASK-002-quality-reviewer`,
      );
      expect(r.status).toBe(0);
      expect(isBlocked(r)).toBe(true);
    });

    test("orchestrator rm's a breaker marker → blocked", () => {
      const r = runHook("orchestrator", `rm ${SD}/breaker/dispatch-abc123`);
      expect(isBlocked(r)).toBe(true);
    });

    test("orchestrator mkdir + touch a review flag (compound) → blocked", () => {
      const r = runHook(
        "orchestrator",
        `mkdir -p ${SD}/reviews && touch ${SD}/reviews/TASK-002-quality-reviewer`,
      );
      expect(isBlocked(r)).toBe(true);
    });

    test("orchestrator redirects into a breaker file → blocked", () => {
      const r = runHook("orchestrator", `echo x > ${SD}/breaker/marker`);
      expect(isBlocked(r)).toBe(true);
    });

    test("orchestrator lists the reviews dir (read) → allowed", () => {
      const r = runHook("orchestrator", `ls ${SD}/reviews/`);
      expect(isBlocked(r)).toBe(false);
    });

    test("orchestrator cats a review flag with 2>/dev/null (read) → allowed", () => {
      const r = runHook(
        "orchestrator",
        `cat ${SD}/reviews/TASK-002-quality-reviewer 2>/dev/null`,
      );
      expect(isBlocked(r)).toBe(false);
    });

    test("quality-reviewer touches its own flag → allowed (reviewer is the writer)", () => {
      const r = runHook(
        "quality-reviewer",
        `mkdir -p ${SD}/reviews && touch ${SD}/reviews/TASK-002-quality-reviewer`,
      );
      expect(isBlocked(r)).toBe(false);
    });

    test("orchestrator rm of an unrelated tmp file → allowed", () => {
      const r = runHook("orchestrator", `rm ${SD}/scratch/note.txt`);
      expect(isBlocked(r)).toBe(false);
    });

    test("chat-orchestrator variant touching a review flag → blocked", () => {
      const r = runHook(
        "chat-orchestrator",
        `touch ${SD}/reviews/TASK-001-quality-reviewer`,
      );
      expect(isBlocked(r)).toBe(true);
    });

    // Regression: the form the codebase teaches the reviewer uses a shell
    // variable, so the literal command text is `…/reviews"` then `$RD/…` and
    // never contains `/reviews/`. The trailing-slash-only guard missed it,
    // letting a confused orchestrator forge a verdict flag through the
    // documented form.
    test("orchestrator forging the flag via the documented variable form → blocked", () => {
      const r = runHook(
        "orchestrator",
        `RD="$(dirname "$TICKET_FILE")/reviews" && mkdir -p "$RD" && touch "$RD/TASK-002-quality-reviewer"`,
      );
      expect(isBlocked(r)).toBe(true);
    });

    test("orchestrator cd-ing into the reviews dir then touching a flag → blocked", () => {
      const r = runHook(
        "orchestrator",
        `cd ${SD}/reviews && touch TASK-002-quality-reviewer`,
      );
      expect(isBlocked(r)).toBe(true);
    });
  });
});
