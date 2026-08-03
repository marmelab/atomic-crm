// Tests for format-on-write.mjs: a PostToolUse(Write|Edit) hook that formats the
// written file using the config's format-step formatter + extension list, on the
// human/main-thread path only (harness subagents are skipped). The formatter here
// is a sentinel-writing script so the test verifies invocation/scoping without
// depending on prettier.

import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, describe, test, expect } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "format-on-write.mjs");

const tmpRepos = [];
afterEach(() => {
  while (tmpRepos.length)
    rmSync(tmpRepos.pop(), { recursive: true, force: true });
});

// Build a temp repo whose format step's formatter is a script that touches a
// sentinel, so we can assert whether it ran. Returns { run(agent, file), sentinel }.
const setup = (extensions = [".ts", ".tsx"]) => {
  const repo = mkdtempSync(join(tmpdir(), "format-on-write-"));
  tmpRepos.push(repo);
  const sentinel = join(repo, ".fmt-ran");
  writeFileSync(join(repo, "fmt.sh"), `#!/bin/sh\ntouch "${sentinel}"\n`);
  writeFileSync(
    join(repo, "harness.config.json"),
    JSON.stringify({
      validation: {
        steps: [
          {
            id: "prettier",
            kind: "format",
            command: "true",
            formatter: `sh ${join(repo, "fmt.sh")}`,
            extensions,
          },
        ],
      },
      roles: {},
    }),
  );
  const run = (agent, file) => {
    const env = { ...process.env, APP_DIR: repo };
    delete env.CLAUDE_PROJECT_DIR;
    delete env.CLAUDE_AGENT_NAME;
    const filePath = join(repo, file);
    writeFileSync(filePath, "const x=1");
    const input = JSON.stringify({
      tool_name: "Write",
      ...(agent ? { agent_type: agent } : {}),
      tool_input: { file_path: filePath },
    });
    return spawnSync("node", [HOOK], { input, env, encoding: "utf8" });
  };
  return { run, sentinel };
};

describe("format-on-write hook", () => {
  test("main thread + matching extension → formatter runs", () => {
    const { run, sentinel } = setup();
    const r = run("", "a.ts");
    expect(r.status).toBe(0);
    expect(existsSync(sentinel)).toBe(true);
  });

  test("harness subagent → skipped (formatter does not run)", () => {
    const { run, sentinel } = setup();
    const r = run("developer", "a.ts");
    expect(r.status).toBe(0);
    expect(existsSync(sentinel)).toBe(false);
  });

  test("non-matching extension → skipped", () => {
    const { run, sentinel } = setup([".ts"]);
    const r = run("", "notes.md");
    expect(r.status).toBe(0);
    expect(existsSync(sentinel)).toBe(false);
  });

  test("unparseable payload → exits 0", () => {
    const r = spawnSync("node", [HOOK], { input: "nope", encoding: "utf8" });
    expect(r.status).toBe(0);
  });
});
