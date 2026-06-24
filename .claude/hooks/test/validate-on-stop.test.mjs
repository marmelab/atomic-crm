// Tests for validate-on-stop.mjs — dry-run short-circuits (VALIDATE_DRY_RUN=1 accepts, =fail exits 2) and the no-active-worktree accept, without running real tools.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterAll, describe, test, expect } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "validate-on-stop.mjs");

const appDir = mkdtempSync(join(tmpdir(), "validate-on-stop-app-"));
const tmpRoot = mkdtempSync(join(tmpdir(), "validate-on-stop-tmp-"));

afterAll(() => {
  rmSync(appDir, { recursive: true, force: true });
  rmSync(tmpRoot, { recursive: true, force: true });
});

const INPUT = '{"session_id":"test-1234","agent_type":"developer"}';

const runHook = (dryRun) => {
  const env = {
    ...process.env,
    APP_DIR: appDir,
    CRM_TMP_ROOT: tmpRoot,
  };
  delete env.VALIDATE_WORKTREE;
  delete env.VALIDATE_DRY_RUN;
  delete env.MODE;
  if (dryRun) env.VALIDATE_DRY_RUN = dryRun;
  return spawnSync("node", [HOOK], { input: INPUT, env, encoding: "utf8" });
};

describe("validate-on-stop hook", () => {
  test("VALIDATE_DRY_RUN=1 → accept (exit 0)", () => {
    const r = runHook("1");
    expect(r.status).toBe(0);
  });

  test("VALIDATE_DRY_RUN=fail → exit 2 with simulated failure on stderr", () => {
    const r = runHook("fail");
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("Validation failed");
    expect(r.stderr).toContain("simulated");
  });

  test("no active worktree → accept (exit 0)", () => {
    const r = runHook("");
    expect(r.status).toBe(0);
  });
});
