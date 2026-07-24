// Tests for lib/progress-log.mjs: appendProgress enriches the #technical-harness
// progress log ONLY when it already exists. The critical invariant: it must NEVER
// create the log, because the log's existence is the technical-run gate (creating it
// on a non-technical run would leak a board into the repo via render-status).

import {
  mkdtempSync,
  existsSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test, expect, beforeEach, afterAll } from "vitest";
import { appendProgress } from "../lib/progress-log.mjs";

let dir;
const log = () => join(dir, "harness-progress.log");
const roots = [];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "progress-log-"));
  roots.push(dir);
});
afterAll(() =>
  roots.forEach((d) => rmSync(d, { recursive: true, force: true })),
);

describe("appendProgress", () => {
  test("does nothing and returns false when the log does not exist (non-technical run)", () => {
    expect(appendProgress(dir, "typecheck…")).toBe(false);
    expect(existsSync(log())).toBe(false); // must NOT create it
  });

  test("appends a timestamped line and returns true when the log exists", () => {
    writeFileSync(log(), "10:00:00 plan ready\n");
    expect(appendProgress(dir, "[validate:TASK-001] typecheck…")).toBe(true);
    const contents = readFileSync(log(), "utf8");
    expect(contents).toContain("plan ready"); // preserves prior content (append only)
    expect(contents).toMatch(
      /\n\d{2}:\d{2}:\d{2} \[validate:TASK-001] typecheck…\n$/,
    );
  });

  test("returns false (never throws) when the session dir is missing", () => {
    expect(appendProgress(join(dir, "does-not-exist"), "x")).toBe(false);
  });
});
