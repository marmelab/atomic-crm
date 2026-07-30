// Tests for reinject-invariants.mjs, a PostCompact hook that re-injects the
// load-bearing harness invariants via hookSpecificOutput.additionalContext.
// It must always exit 0 (fail-open), emit parseable JSON, and stay compact.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, test, expect } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "reinject-invariants.mjs");

const runHook = (payload) =>
  spawnSync("node", [HOOK], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8",
  });

const parse = (r) => JSON.parse(r.stdout);

describe("reinject-invariants hook", () => {
  test("emits additionalContext on a PostCompact payload", () => {
    const r = runHook({
      hook_event_name: "PostCompact",
      trigger: "auto",
      compact_summary: "previous work summary",
    });
    expect(r.status).toBe(0);
    const out = parse(r);
    expect(out.hookSpecificOutput.hookEventName).toBe("PostCompact");
    expect(out.hookSpecificOutput.additionalContext).toMatch(
      /harness-invariants/,
    );
  });

  test("injected block covers the load-bearing invariants", () => {
    const out = parse(
      runHook({ hook_event_name: "PostCompact", trigger: "manual" }),
    );
    const ctx = out.hookSpecificOutput.additionalContext;
    expect(ctx).toMatch(/Worktree scope/);
    expect(ctx).toMatch(/Launched is NOT done/);
    expect(ctx).toMatch(/orchestrator runs/i);
    expect(ctx).toMatch(/Git rights/);
  });

  test("injected block stays under 25 lines", () => {
    const out = parse(
      runHook({ hook_event_name: "PostCompact", trigger: "auto" }),
    );
    const lines = out.hookSpecificOutput.additionalContext.split("\n").length;
    expect(lines).toBeLessThanOrEqual(25);
  });

  test("fails open on an unparseable payload (still exit 0, still emits)", () => {
    const r = runHook("not json at all");
    expect(r.status).toBe(0);
    expect(parse(r).hookSpecificOutput.additionalContext).toMatch(
      /harness-invariants/,
    );
  });

  test("fails open on empty stdin", () => {
    const r = spawnSync("node", [HOOK], { input: "", encoding: "utf8" });
    expect(r.status).toBe(0);
  });
});
