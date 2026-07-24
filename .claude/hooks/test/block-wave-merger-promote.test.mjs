// Tests for block-wave-merger-promote.mjs: the PreToolUse(Bash) guard that stops a
// Stage-A-only merger (a per-ticket wave merge, or STAGE: a-only) from running Stage B
// (promoting session/<short> into the base branch). Authorization is recorded at
// dispatch by record-merger-stage.mjs into <sessionDir>/merger-stage.json; the guard
// exits 2 to block and 0 to allow, and fails CLOSED when no marker exists.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  describe,
  test,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";
import { sanitizePath } from "../lib/paths.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BLOCK = join(HERE, "..", "block-wave-merger-promote.mjs");
const RECORD = join(HERE, "..", "record-merger-stage.mjs");
const SS = "ab12cd34";
const SESSION_ID = `${SS}-1111-2222-3333-444455556666`;
const STAGE_B = `cd /wt && git merge --no-ff session/${SS} -m "merge(session): ${SS}"`;
const STAGE_A = `cd /wt && git merge --no-ff ${SS}/TASK-001 -m "merge(${SS}/TASK-001)"`;

let TMP, APP_DIR, env, sessionDir, marker;

const setMarker = (promote) =>
  writeFileSync(marker, JSON.stringify({ promote }));
const clearMarker = () => rmSync(marker, { force: true });

// The Bash guard: agent_type carries the (possibly suffixed) merger identity.
const runBlock = (command, agentType = "merger") =>
  spawnSync("node", [BLOCK], {
    input: JSON.stringify({
      tool_name: "Bash",
      agent_type: agentType,
      session_id: SESSION_ID,
      tool_input: { command },
    }),
    env,
    encoding: "utf8",
  }).status;

// The Agent dispatch recorder: writes the marker as a side effect.
const runRecord = (prompt) =>
  spawnSync("node", [RECORD], {
    input: JSON.stringify({
      session_id: SESSION_ID,
      tool_input: { subagent_type: "merger", prompt },
    }),
    env,
    encoding: "utf8",
  }).status;

beforeAll(() => {
  TMP = mkdtempSync(join(tmpdir(), "wave-merger-promote-test-"));
  APP_DIR = join(TMP, "app");
  const CRM_TMP_ROOT = join(TMP, "scratch");
  sessionDir = join(CRM_TMP_ROOT, sanitizePath(APP_DIR), SESSION_ID);
  marker = join(sessionDir, "merger-stage.json");
  mkdirSync(sessionDir, { recursive: true });
  env = { ...process.env, APP_DIR, CRM_TMP_ROOT };
  delete env.CHAT_SESSION_DIR;
  delete env.CLAUDE_AGENT_NAME;
});

beforeEach(() => clearMarker());
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe("block-wave-merger-promote", () => {
  test("blocks a Stage-B promotion when the marker says promote=false", () => {
    setMarker(false);
    expect(runBlock(STAGE_B)).toBe(2);
  });

  test("allows a Stage-B promotion when the marker says promote=true", () => {
    setMarker(true);
    expect(runBlock(STAGE_B)).toBe(0);
  });

  test("fails CLOSED (blocks) when no authorization marker exists", () => {
    expect(runBlock(STAGE_B)).toBe(2);
  });

  test("allows a Stage-A merge (task branch into session), even for a Stage-A-only merger", () => {
    setMarker(false);
    expect(runBlock(STAGE_A)).toBe(0);
  });

  test("detects the promotion via the merge(session) message alone", () => {
    setMarker(false);
    expect(runBlock(`git merge --no-ff HEAD -m "merge(session): ${SS}"`)).toBe(
      2,
    );
  });

  test("ignores a non-merger caller running the same command", () => {
    setMarker(false);
    expect(runBlock(STAGE_B, "developer")).toBe(0);
  });

  test("ignores a merger command that is not a git merge", () => {
    setMarker(false);
    expect(runBlock(`git checkout session/${SS}`)).toBe(0);
  });

  describe("integration with record-merger-stage", () => {
    test("wave dispatch (TASK-XXX + STAGE: a-only) records promote=false -> Stage B blocked", () => {
      expect(
        runRecord(
          `ROLE: merger\nTASK_ID: TASK-001\nSTAGE: a-only\nBRANCH_NAME: ${SS}/TASK-001`,
        ),
      ).toBe(0);
      expect(runBlock(STAGE_B)).toBe(2);
    });

    test("plain wave dispatch (TASK-XXX, no STAGE) still records promote=false -> Stage B blocked", () => {
      expect(
        runRecord(
          `ROLE: merger\nTASK_ID: TASK-001\nBRANCH_NAME: ${SS}/TASK-001`,
        ),
      ).toBe(0);
      expect(runBlock(STAGE_B)).toBe(2);
    });

    test("promotion dispatch (MODE: promote) records promote=true -> Stage B allowed", () => {
      expect(
        runRecord(`ROLE: merger\nMODE: promote\nSESSION_SHORT_ID: ${SS}`),
      ).toBe(0);
      expect(runBlock(STAGE_B)).toBe(0);
    });

    test("SIMPLE single-shot dispatch records promote=true -> Stage B allowed", () => {
      expect(
        runRecord(`ROLE: merger (SIMPLE mode)\nBRANCH_NAME: ${SS}/simple`),
      ).toBe(0);
      expect(runBlock(STAGE_B)).toBe(0);
    });
  });
});
