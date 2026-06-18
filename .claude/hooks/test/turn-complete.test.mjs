// Tests for turn-complete.mjs — the Stop hook that drops a per-session sentinel
// (/tmp/pty-sentinels/pty-turn-done-<session_id>) the chat-service PtySession
// watcher polls. Must always exit 0 (a Stop hook never blocks) and never throw on
// a missing/malformed payload.

import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, test, expect, afterAll } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "turn-complete.mjs");
// A unique id so the test never collides with a real session's sentinel.
const SID = "turn-complete-test-7e3a9f21";
const sentinel = join("/tmp/pty-sentinels", `pty-turn-done-${SID}`);

const run = (input) => spawnSync("node", [HOOK], { input, encoding: "utf8" });

afterAll(() => rmSync(sentinel, { force: true }));

describe("turn-complete", () => {
  test("creates the per-session sentinel and exits 0", () => {
    const r = run(JSON.stringify({ session_id: SID }));
    expect(r.status).toBe(0);
    expect(existsSync(sentinel)).toBe(true);
  });

  test("no session id → no throw, exits 0", () => {
    expect(run(JSON.stringify({})).status).toBe(0);
  });

  test("malformed payload → no throw, exits 0", () => {
    expect(run("not json").status).toBe(0);
  });
});
