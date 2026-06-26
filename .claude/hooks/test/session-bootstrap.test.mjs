// Tests for session-bootstrap.mjs — the SessionStart hook that injects
// <session_dir> via hookSpecificOutput.additionalContext so the harness can run
// on any surface without a launch script. Key invariant: the injected dir is
// ctx.sessionDir = <TMP_ROOT>/<sanitized repo>/<session_id>, so its basename is
// the real session id (what setup-worktree and the orchestrator also key off).

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterAll, describe, test, expect } from "vitest";
import { sanitizePath } from "../lib/paths.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "session-bootstrap.mjs");
const TMP = mkdtempSync(join(tmpdir(), "session-bootstrap-test-"));
const APP_DIR = join(TMP, "repo");
const CRM_TMP_ROOT = join(TMP, "scratch");
const SESSION_ID = "abcd1234-1111-2222-3333-444455556666";

const baseEnv = { ...process.env, APP_DIR, CRM_TMP_ROOT };
delete baseEnv.CHAT_SESSION_DIR;
delete baseEnv.CLAUDE_CODE_SESSION_ID;

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

const run = (payload, extraEnv = {}) =>
  spawnSync("node", [HOOK], {
    input: payload === undefined ? "" : JSON.stringify(payload),
    env: { ...baseEnv, ...extraEnv },
    encoding: "utf8",
  });

describe("session-bootstrap", () => {
  test("injects <session_dir> built from the real session id", () => {
    const r = run({ session_id: SESSION_ID });
    expect(r.status).toBe(0);
    const expectedDir = join(CRM_TMP_ROOT, sanitizePath(APP_DIR), SESSION_ID);
    expect(r.stdout).toContain(`<session_dir>${expectedDir}</session_dir>`);
    // Alignment invariant: basename(session_dir) === session_id.
    const m = r.stdout.match(/<session_dir>(.+?)<\/session_dir>/);
    expect(m && m[1].split("/").pop()).toBe(SESSION_ID);
  });

  test("emits valid additionalContext JSON for SessionStart", () => {
    const r = run({ session_id: SESSION_ID });
    const parsed = JSON.parse(r.stdout.trim());
    expect(parsed.hookSpecificOutput.hookEventName).toBe("SessionStart");
    expect(parsed.hookSpecificOutput.additionalContext).toContain(
      "<session_dir>",
    );
  });

  test("stays out of the way when a managed launcher owns the session", () => {
    const r = run(
      { session_id: SESSION_ID },
      { CHAT_SESSION_DIR: "/tmp/atomic-crm-harness/managed" },
    );
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain("<session_dir>");
  });

  test("exits cleanly with no output when there is no payload", () => {
    const r = run(undefined);
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain("<session_dir>");
  });
});
