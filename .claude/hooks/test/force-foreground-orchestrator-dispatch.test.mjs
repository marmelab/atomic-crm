// Tests for force-foreground-orchestrator-dispatch.mjs. The gate exists because a
// nested subagent is never re-invoked when a background child completes, so a
// background pipeline dispatch orphans review/merge/promotion. Only an EXPLICIT
// run_in_background:false may pass: absent means the extension's background default,
// which IS the bug (3K loosened exactly this and neutered the gate).

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "force-foreground-orchestrator-dispatch.mjs");
const TMP = mkdtempSync(join(tmpdir(), "force-fg-dispatch-"));

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

// `runInBackground` omitted entirely when `undefined`, so the payload matches what a
// client that never sends the field actually produces.
const run = ({ subagentType, prompt = "", runInBackground }) => {
  const toolInput = { subagent_type: subagentType, prompt };
  if (runInBackground !== undefined)
    toolInput.run_in_background = runInBackground;
  return spawnSync("node", [HOOK], {
    input: JSON.stringify({
      tool_name: "Agent",
      session_id: "fg-1234",
      tool_input: toolInput,
    }),
    env: { ...process.env, APP_DIR: TMP },
    encoding: "utf8",
  });
};

const isBlocked = (r) => r.stdout.includes('"decision":"block"');

describe("force-foreground-orchestrator-dispatch", () => {
  const PIPELINE = [
    "planner",
    "developer",
    "quality-reviewer",
    "merger",
    "test-writer",
  ];

  test.each(PIPELINE)("%s dispatched in the background → blocked", (role) => {
    const r = run({ subagentType: role, runInBackground: true });
    expect(r.status).toBe(0);
    expect(isBlocked(r)).toBe(true);
    expect(r.stdout).toContain(role);
  });

  // The regression that matters: absent is NOT the same as false.
  test.each(PIPELINE)(
    "%s dispatched with run_in_background absent → blocked",
    (role) => {
      const r = run({ subagentType: role });
      expect(isBlocked(r)).toBe(true);
    },
  );

  test.each(PIPELINE)("%s dispatched with explicit false → allowed", (role) => {
    const r = run({ subagentType: role, runInBackground: false });
    expect(r.status).toBe(0);
    expect(isBlocked(r)).toBe(false);
  });

  // main -> orchestrator and the fire-and-forget documentator are pipeline:false in
  // harness.config.json, so their background dispatch is correct and must pass.
  test.each(["orchestrator", "documentator"])(
    "%s in the background → allowed (not a pipeline role)",
    (role) => {
      expect(
        isBlocked(run({ subagentType: role, runInBackground: true })),
      ).toBe(false);
    },
  );

  test("recognises the child role from the prompt's ROLE: line", () => {
    const r = run({
      subagentType: "",
      prompt: "ROLE: merger\nTASK_ID: TASK-004\n",
      runInBackground: true,
    });
    expect(isBlocked(r)).toBe(true);
    expect(r.stdout).toContain("merger");
  });

  test("an unparseable payload allows the dispatch (fail-open)", () => {
    const r = spawnSync("node", [HOOK], {
      input: "not json",
      env: { ...process.env, APP_DIR: TMP },
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    expect(isBlocked(r)).toBe(false);
  });
});
