// Tests for restrict-documentator-write.mjs — the DOCUMENTATOR_RUN=1 allowlist (ledger, settings.local.json, MEMORY.md, CONFIG_DIR/local/**) and pass-through when inactive (vitest, Node project).

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, test, expect } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "restrict-documentator-write.mjs");

const baseEnv = {
  ...process.env,
  CLAUDE_PROJECT_DIR: "/app",
  CLAUDE_CONFIG_DIR: "/home/developer/.claude",
};
delete baseEnv.APP_DIR;

const runHook = (envFlag, input) => {
  const env = { ...baseEnv };
  if (envFlag) env.DOCUMENTATOR_RUN = envFlag;
  else delete env.DOCUMENTATOR_RUN;
  return spawnSync("node", [HOOK], { input, env, encoding: "utf8" }).status;
};

describe("restrict-documentator-write hook", () => {
  test("non-documentator session, any path → allowed", () => {
    expect(
      runHook(
        "",
        '{"tool_name":"Edit","tool_input":{"file_path":"/app/src/App.tsx"}}',
      ),
    ).toBe(0);
  });

  test("non-documentator session, base agent path → allowed", () => {
    expect(
      runHook(
        "",
        '{"tool_name":"Write","tool_input":{"file_path":"/home/developer/.claude/agents/anything.md"}}',
      ),
    ).toBe(0);
  });

  test("ledger write → allowed", () => {
    expect(
      runHook(
        "1",
        '{"tool_name":"Write","tool_input":{"file_path":"/app/docs/learnings/patterns.md"}}',
      ),
    ).toBe(0);
  });

  test("settings.local.json write → allowed", () => {
    expect(
      runHook(
        "1",
        '{"tool_name":"Write","tool_input":{"file_path":"/home/developer/.claude/settings.local.json"}}',
      ),
    ).toBe(0);
  });

  test("local/agents file → allowed", () => {
    expect(
      runHook(
        "1",
        '{"tool_name":"Write","tool_input":{"file_path":"/home/developer/.claude/local/agents/my-agent.md"}}',
      ),
    ).toBe(0);
  });

  test("local/skills file → allowed", () => {
    expect(
      runHook(
        "1",
        '{"tool_name":"Write","tool_input":{"file_path":"/home/developer/.claude/local/skills/my-skill/SKILL.md"}}',
      ),
    ).toBe(0);
  });

  test("local/hooks file → allowed", () => {
    expect(
      runHook(
        "1",
        '{"tool_name":"Write","tool_input":{"file_path":"/home/developer/.claude/local/hooks/my-hook.mjs"}}',
      ),
    ).toBe(0);
  });

  test("local/rules file → allowed", () => {
    expect(
      runHook(
        "1",
        '{"tool_name":"Write","tool_input":{"file_path":"/home/developer/.claude/local/rules/my-rule.md"}}',
      ),
    ).toBe(0);
  });

  test("base agents/ write → blocked", () => {
    expect(
      runHook(
        "1",
        '{"tool_name":"Write","tool_input":{"file_path":"/home/developer/.claude/agents/foo.md"}}',
      ),
    ).toBe(2);
  });

  test("base settings.json write → blocked", () => {
    expect(
      runHook(
        "1",
        '{"tool_name":"Write","tool_input":{"file_path":"/home/developer/.claude/settings.json"}}',
      ),
    ).toBe(2);
  });

  test("base hooks/ write → blocked", () => {
    expect(
      runHook(
        "1",
        '{"tool_name":"Write","tool_input":{"file_path":"/home/developer/.claude/hooks/foo.mjs"}}',
      ),
    ).toBe(2);
  });

  test("app source code → blocked", () => {
    expect(
      runHook(
        "1",
        '{"tool_name":"Edit","tool_input":{"file_path":"/app/src/App.tsx"}}',
      ),
    ).toBe(2);
  });

  test("worktree code → blocked", () => {
    expect(
      runHook(
        "1",
        '{"tool_name":"Edit","tool_input":{"file_path":"/app/worktrees/TASK-001/src/foo.ts"}}',
      ),
    ).toBe(2);
  });

  test("empty file_path → blocked", () => {
    expect(
      runHook("1", '{"tool_name":"Write","tool_input":{"file_path":""}}'),
    ).toBe(2);
  });

  test("missing file_path → blocked", () => {
    expect(runHook("1", '{"tool_name":"Write","tool_input":{}}')).toBe(2);
  });

  test("malformed JSON → blocked", () => {
    expect(runHook("1", "not-json{")).toBe(2);
  });

  test("path that contains 'local/' but not under base local/ → blocked", () => {
    expect(
      runHook(
        "1",
        '{"tool_name":"Write","tool_input":{"file_path":"/app/some/local/file.md"}}',
      ),
    ).toBe(2);
  });

  test("ledger lookalike (subpath) → blocked", () => {
    expect(
      runHook(
        "1",
        '{"tool_name":"Write","tool_input":{"file_path":"/app/docs/learnings/patterns.md.bak"}}',
      ),
    ).toBe(2);
  });
});
