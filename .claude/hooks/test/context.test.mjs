// Tests for lib/context.mjs — specifically the worktreeBase switch that the
// #technical-harness opt-in relies on. paths.mjs reads APP_DIR / CRM_TMP_ROOT at
// import time, so env is set BEFORE the dynamic import of context.mjs.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const SESSION_ID = "ab12cd34-1111-2222-3333-444455556666";

let TMP;
let APP_DIR;
let CRM_TMP_ROOT;
let sanitizePath;
let createHookContext;
let sessionDir;

beforeAll(async () => {
  TMP = mkdtempSync(join(tmpdir(), "ctx-test-"));
  APP_DIR = join(TMP, "app");
  CRM_TMP_ROOT = join(TMP, "scratch");
  mkdirSync(APP_DIR, { recursive: true });
  process.env.APP_DIR = APP_DIR;
  process.env.CRM_TMP_ROOT = CRM_TMP_ROOT;

  ({ sanitizePath } = await import("../lib/paths.mjs"));
  ({ createHookContext } = await import("../lib/context.mjs"));
  sessionDir = join(CRM_TMP_ROOT, sanitizePath(APP_DIR), SESSION_ID);
  mkdirSync(sessionDir, { recursive: true });
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
  delete process.env.APP_DIR;
  delete process.env.CRM_TMP_ROOT;
});

describe("worktreeBase", () => {
  test("defaults to the /tmp sessionDir when no technical marker is present", () => {
    // Arrange / Act
    const ctx = createHookContext({ session_id: SESSION_ID }, "test");

    // Assert
    expect(ctx.worktreeBase).toBe(sessionDir);
  });

  test("moves in-repo when the .technical-persona marker is present", () => {
    // Arrange
    writeFileSync(join(sessionDir, ".technical-persona"), "");

    // Act
    const ctx = createHookContext({ session_id: SESSION_ID }, "test");

    // Assert
    expect(ctx.worktreeBase).toBe(
      join(APP_DIR, ".harness-worktrees", SESSION_ID),
    );
    // sessionDir / tickets / logs stay in /tmp regardless — only the base moves.
    expect(ctx.sessionDir).toBe(sessionDir);
  });
});
