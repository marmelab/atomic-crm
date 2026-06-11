// Tests for teamdelete-cleanup.mjs — PostToolUse(TeamDelete) disk cleanup. Removes
// <TEAMS_DIR>/<team_name> on success; always exits 0. TEAMS_DIR is derived from
// CLAUDE_CONFIG_DIR (<config>/teams), which the test points at a sandbox.

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, test, expect } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "teamdelete-cleanup.mjs");

let configDir;
let teamsDir;

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), "td-cleanup-cfg-"));
  teamsDir = join(configDir, "teams");
  mkdirSync(teamsDir, { recursive: true });
});

afterEach(() => {
  rmSync(configDir, { recursive: true, force: true });
});

const makeTeamDir = (name) => {
  const dir = join(teamsDir, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "config.json"), "{}");
  return dir;
};

const runHook = (payload) => {
  const env = { ...process.env, CLAUDE_CONFIG_DIR: configDir };
  delete env.CLAUDE_AGENT_NAME;
  return spawnSync("node", [HOOK], {
    input: JSON.stringify(payload),
    env,
    encoding: "utf8",
  });
};

describe("teamdelete-cleanup hook", () => {
  test("removes the team directory on a successful delete", () => {
    const dir = makeTeamDir("tickets-abc123");
    const r = runHook({
      tool_name: "TeamDelete",
      session_id: "td-1",
      tool_input: { team_name: "tickets-abc123" },
      tool_response: { success: true, team_name: "tickets-abc123" },
    });
    expect(r.status).toBe(0);
    expect(existsSync(dir)).toBe(false);
  });

  test("keeps the directory when the delete was not successful", () => {
    const dir = makeTeamDir("tickets-keep");
    const r = runHook({
      tool_name: "TeamDelete",
      session_id: "td-2",
      tool_input: { team_name: "tickets-keep" },
      tool_response: { success: false },
    });
    expect(r.status).toBe(0);
    expect(existsSync(dir)).toBe(true);
  });

  test("refuses path-traversal team names and removes nothing", () => {
    const sibling = join(configDir, "secret");
    mkdirSync(sibling, { recursive: true });
    const r = runHook({
      tool_name: "TeamDelete",
      session_id: "td-3",
      tool_input: { team_name: "../secret" },
      tool_response: { success: true, team_name: "../secret" },
    });
    expect(r.status).toBe(0);
    expect(existsSync(sibling)).toBe(true);
  });

  test("no-op (still exit 0) when the team directory is already gone", () => {
    const r = runHook({
      tool_name: "TeamDelete",
      session_id: "td-4",
      tool_input: { team_name: "tickets-absent" },
      tool_response: { success: true, team_name: "tickets-absent" },
    });
    expect(r.status).toBe(0);
  });
});
