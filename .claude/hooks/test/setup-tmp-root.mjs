import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

const throwawayTmpRoot = mkdtempSync(join(tmpdir(), "harness-test-tmp-"));
process.env.HARNESS_TMP_ROOT = throwawayTmpRoot;

afterAll(() => {
  rmSync(throwawayTmpRoot, { recursive: true, force: true });
});
