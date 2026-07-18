// Tests for check-typescript-shortcuts.mjs, a non-blocking PostToolUse(Write|Edit)
// flag. It scans the written .ts/.tsx file for typing escape hatches and exits 1
// (flag, not block) with a stderr warning when it finds one; exit 0 otherwise.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterAll, describe, test, expect } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "check-typescript-shortcuts.mjs");

const tmpRoot = mkdtempSync(join(tmpdir(), "ts-shortcuts-"));

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

// Write `source` to a file named `name`, then run the hook against it.
const runHook = (name, source) => {
  const filePath = join(tmpRoot, name);
  writeFileSync(filePath, source);
  const input = JSON.stringify({
    tool_name: "Write",
    session_id: "test-1234",
    tool_input: { file_path: filePath },
  });
  return spawnSync("node", [HOOK], { input, encoding: "utf8" });
};

const isFlagged = (r) => r.status === 1;

describe("check-typescript-shortcuts hook", () => {
  describe("typing escape hatches → flagged (exit 1)", () => {
    const flagged = [
      ["as-any.ts", "const x = value as any;"],
      ["colon-any.ts", "let count: any = 0;"],
      ["tsfixme.ts", "type T = $TSFixMe;"],
      ["bare-ts-ignore.ts", "// @ts-ignore\nconst y = z.foo;"],
      ["bare-ts-expect-error.tsx", "// @ts-expect-error\nreturn <div/>;"],
    ];

    test.each(flagged)("%s → flagged", (name, source) => {
      const r = runHook(name, source);
      expect(isFlagged(r)).toBe(true);
      expect(r.stderr).toMatch(/typing workaround/);
    });
  });

  describe("clean or justified code → not flagged (exit 0)", () => {
    const clean = [
      ["typed.ts", "const x: number = 1;\nconst s: string = 'ok';"],
      [
        "justified.ts",
        "// @ts-expect-error legacy API returns an untyped payload\nconst y = z.foo;",
      ],
      ["anyword.ts", "const anything: string = 'not a match';"],
    ];

    test.each(clean)("%s → not flagged", (name, source) => {
      const r = runHook(name, source);
      expect(r.status).toBe(0);
    });
  });

  test("non-TS file → ignored", () => {
    const r = runHook("notes.md", "this has as any inside prose");
    expect(r.status).toBe(0);
  });

  test("unparseable payload → fails open (exit 0)", () => {
    const r = spawnSync("node", [HOOK], {
      input: "not json",
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
  });
});
