// Tests for lib/validation.mjs: scopedLintFiles — the pure file-selection the
// lint step feeds to eslint (extension filter + must-still-exist-on-disk).

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test, expect } from "vitest";
import { scopedLintFiles } from "../lib/validation.mjs";

const EXT = [".ts", ".tsx", ".mjs"];

const tmpDirs = [];
const makeCwd = (files) => {
  const dir = mkdtempSync(join(tmpdir(), "scoped-lint-"));
  tmpDirs.push(dir);
  for (const f of files) writeFileSync(join(dir, f), "");
  return dir;
};

afterEach(() => {
  while (tmpDirs.length)
    rmSync(tmpDirs.pop(), { recursive: true, force: true });
});

describe("scopedLintFiles", () => {
  test("keeps only lintable extensions", () => {
    const cwd = makeCwd(["a.ts", "b.tsx", "c.mjs", "d.css", "e.sql", "f.md"]);
    expect(
      scopedLintFiles(
        ["a.ts", "b.tsx", "c.mjs", "d.css", "e.sql", "f.md"],
        cwd,
        EXT,
      ),
    ).toEqual(["a.ts", "b.tsx", "c.mjs"]);
  });

  test("drops paths that no longer exist (deleted / renamed away)", () => {
    const cwd = makeCwd(["kept.ts"]);
    expect(scopedLintFiles(["kept.ts", "gone.ts"], cwd, EXT)).toEqual([
      "kept.ts",
    ]);
  });

  test("empty change set → empty list (nothing to lint)", () => {
    const cwd = makeCwd([]);
    expect(scopedLintFiles([], cwd, EXT)).toEqual([]);
  });

  test("a diff of only non-code files → empty list", () => {
    const cwd = makeCwd(["schema.sql", "notes.md"]);
    expect(scopedLintFiles(["schema.sql", "notes.md"], cwd, EXT)).toEqual([]);
  });
});
