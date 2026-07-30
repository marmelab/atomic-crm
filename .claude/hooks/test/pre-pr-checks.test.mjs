// Tests for pre-pr-checks.mjs: a PreToolUse(Bash) hook that runs the config's
// typecheck/lint steps before `gh pr create` / `git push`, on the human path
// only. exit 2 blocks the push; harness subagents and non-trigger commands pass.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, describe, test, expect } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "pre-pr-checks.mjs");

const tmpRepos = [];
afterEach(() => {
  while (tmpRepos.length)
    rmSync(tmpRepos.pop(), { recursive: true, force: true });
});

// Temp repo with a single typecheck step whose command is `true` (passes) or
// `false` (fails). Returns run(agent, command).
const setup = (checkCommand) => {
  const repo = mkdtempSync(join(tmpdir(), "pre-pr-"));
  tmpRepos.push(repo);
  writeFileSync(
    join(repo, "harness.config.json"),
    JSON.stringify({
      validation: {
        steps: [{ id: "typecheck", kind: "typecheck", command: checkCommand }],
      },
      roles: {},
    }),
  );
  return (agent, command) => {
    const env = { ...process.env, APP_DIR: repo };
    delete env.CLAUDE_PROJECT_DIR;
    delete env.CLAUDE_AGENT_NAME;
    const input = JSON.stringify({
      tool_name: "Bash",
      ...(agent ? { agent_type: agent } : {}),
      tool_input: { command },
    });
    return spawnSync("node", [HOOK], { input, env, encoding: "utf8" });
  };
};

describe("pre-pr-checks hook", () => {
  test("git push with a failing check → blocked (exit 2)", () => {
    const run = setup("false");
    const r = run("", "git push origin HEAD");
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("typecheck");
  });

  test("git push with a passing check → allowed (exit 0)", () => {
    const run = setup("true");
    const r = run("", "git push origin HEAD");
    expect(r.status).toBe(0);
  });

  test("gh pr create triggers the checks", () => {
    const run = setup("false");
    const r = run("", "gh pr create --fill");
    expect(r.status).toBe(2);
  });

  test("non-trigger command → not checked (exit 0)", () => {
    const run = setup("false");
    const r = run("", "git status");
    expect(r.status).toBe(0);
  });

  test("harness subagent pushing → skipped (exit 0, dev-agent stops unaffected)", () => {
    const run = setup("false");
    const r = run("developer", "git push origin HEAD");
    expect(r.status).toBe(0);
  });
});
