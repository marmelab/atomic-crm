// Tests for scripts/check-config-sync.mjs: settings.json SubagentStop role
// matchers must all be declared in harness.config.json (config.roles).

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, describe, test, expect } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "..", "..", "scripts", "check-config-sync.mjs");
const REPO_ROOT = join(HERE, "..", "..", "..");

const tmpRepos = [];
afterEach(() => {
  while (tmpRepos.length)
    rmSync(tmpRepos.pop(), { recursive: true, force: true });
});

// Build a temp repo with a harness.config.json (roles) and a settings.json
// (SubagentStop matchers), then run the script against it.
const runAgainst = ({ roles, matchers }) => {
  const repo = mkdtempSync(join(tmpdir(), "config-sync-"));
  tmpRepos.push(repo);
  mkdirSync(join(repo, ".claude"), { recursive: true });
  const rolesObj = Object.fromEntries(
    roles.map((r) => [r, { model: "sonnet" }]),
  );
  writeFileSync(
    join(repo, "harness.config.json"),
    JSON.stringify({ validation: { steps: [] }, roles: rolesObj }),
  );
  const SubagentStop = matchers.map((m) => ({ matcher: m, hooks: [] }));
  writeFileSync(
    join(repo, ".claude", "settings.json"),
    JSON.stringify({ hooks: { SubagentStop } }),
  );
  return spawnSync("node", [SCRIPT, "--app", repo], { encoding: "utf8" });
};

describe("check-config-sync", () => {
  test("all matcher tokens declared → exit 0", () => {
    const r = runAgainst({
      roles: ["developer", "test-writer", "merger"],
      matchers: ["developer|test-writer", "merger"],
    });
    expect(r.status).toBe(0);
  });

  test("a matcher token missing from config.roles → exit 1", () => {
    const r = runAgainst({
      roles: ["developer", "merger"],
      matchers: ["developer|test-writer", "merger"],
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("test-writer");
  });

  test("renaming a role in BOTH files stays in sync → exit 0", () => {
    const r = runAgainst({
      roles: ["dev", "merger"],
      matchers: ["dev", "merger"],
    });
    expect(r.status).toBe(0);
  });

  test("the committed repo is in sync → exit 0", () => {
    const r = spawnSync("node", [SCRIPT, "--app", REPO_ROOT], {
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
  });
});
