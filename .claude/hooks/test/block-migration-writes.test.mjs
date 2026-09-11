// Tests for block-migration-writes.mjs. Migrations are deferred to the deploy-time
// round, which always runs on the shared <base>/simple worktree via the
// writing-migrations skill. The worktree path in the write target is the
// discriminator, since the dispatch intent is not visible at Write time.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "block-migration-writes.mjs");
const TMP = mkdtempSync(join(tmpdir(), "block-migration-writes-"));
const WB = "/tmp/_repo/abcd1234";

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

const run = (agentName, filePath) => {
  const env = { ...process.env, APP_DIR: TMP };
  delete env.CLAUDE_AGENT_NAME;
  if (agentName) env.CLAUDE_AGENT_NAME = agentName;
  return spawnSync("node", [HOOK], {
    input: JSON.stringify({
      tool_name: "Write",
      session_id: "mig-1234",
      tool_input: { file_path: filePath },
    }),
    env,
    encoding: "utf8",
  });
};

const isBlocked = (r) => r.stdout.includes('"decision":"block"');

describe("block-migration-writes", () => {
  test("a per-ticket developer writing a migration → blocked", () => {
    const r = run(
      "developer-TASK-003",
      `${WB}/TASK-003/supabase/migrations/20260101_add_col.sql`,
    );
    expect(r.status).toBe(0);
    expect(isBlocked(r)).toBe(true);
    expect(r.stdout).toContain("writing-migrations");
  });

  test("the same developer on the simple worktree → allowed (migration round)", () => {
    const r = run(
      "developer",
      `${WB}/simple/supabase/migrations/20260101_add_col.sql`,
    );
    expect(r.status).toBe(0);
    expect(isBlocked(r)).toBe(false);
  });

  test("migrations-pending is blocked for everyone, on any worktree", () => {
    for (const agent of ["developer", "developer-TASK-007", "merger", ""]) {
      const r = run(
        agent,
        `${WB}/simple/supabase/migrations-pending/20260101_x.sql`,
      );
      expect(isBlocked(r)).toBe(true);
    }
  });

  test("a developer writing application code → allowed", () => {
    const r = run(
      "developer-TASK-003",
      `${WB}/TASK-003/src/components/atomic-crm/deals/DealList.tsx`,
    );
    expect(isBlocked(r)).toBe(false);
  });

  test("a developer writing a declarative schema file → allowed", () => {
    // Schemas are the source of truth a ticket DOES edit; only migrations/ is deferred.
    const r = run(
      "developer-TASK-003",
      `${WB}/TASK-003/supabase/schemas/01_tables.sql`,
    );
    expect(isBlocked(r)).toBe(false);
  });

  test("an empty file_path is a no-op", () => {
    const r = run("developer-TASK-003", "");
    expect(r.status).toBe(0);
    expect(isBlocked(r)).toBe(false);
  });
});
