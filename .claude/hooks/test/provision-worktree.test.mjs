// Tests for the config-driven worktree provisioning dispatcher
// (context.mjs provisionWorktree, config.worktree.provision): `npm-link`
// (builtin), `none` (no-op), or a script path. Run in a child node process with
// APP_DIR pointing at a temp repo, so paths.mjs REPO resolves to that repo's
// harness.config.json.

import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, describe, test, expect } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const CTX_URL = pathToFileURL(join(HERE, "..", "lib", "context.mjs")).href;

const tmpDirs = [];
afterEach(() => {
  while (tmpDirs.length)
    rmSync(tmpDirs.pop(), { recursive: true, force: true });
});

// Run provisionWorktree(wt) in a child process whose REPO is `repo`.
const runProvision = (repo, wt) => {
  const script = `
    const { createHookContext } = await import(${JSON.stringify(CTX_URL)});
    const ctx = createHookContext({ session_id: "prov-test" }, "prov");
    ctx.provisionWorktree(process.env.WT);
    console.log("PROVISION_OK");
  `;
  const env = { ...process.env, APP_DIR: repo, WT: wt };
  delete env.CLAUDE_PROJECT_DIR;
  return spawnSync("node", ["--input-type=module", "-e", script], {
    env,
    encoding: "utf8",
  });
};

const makeRepo = (provision) => {
  const repo = mkdtempSync(join(tmpdir(), "provision-repo-"));
  tmpDirs.push(repo);
  writeFileSync(
    join(repo, "harness.config.json"),
    JSON.stringify({
      validation: { steps: [] },
      roles: {},
      worktree: { provision },
    }),
  );
  return repo;
};

const makeWorktree = () => {
  const wt = mkdtempSync(join(tmpdir(), "provision-wt-"));
  tmpDirs.push(wt);
  return wt;
};

describe("worktree provisioning dispatcher", () => {
  test("`none` provisions nothing and does not error", () => {
    const repo = makeRepo("none");
    const wt = makeWorktree();
    const r = runProvision(repo, wt);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PROVISION_OK");
    expect(existsSync(join(wt, "node_modules"))).toBe(false);
  });

  test("a script path is run with the worktree as its argument", () => {
    const repo = makeRepo("provision.sh");
    const sentinel = join(repo, ".provisioned");
    // $1 is the worktree path; the script records that it ran.
    writeFileSync(
      join(repo, "provision.sh"),
      `#!/bin/sh\necho "$1" > "${sentinel}"\n`,
    );
    const wt = makeWorktree();
    const r = runProvision(repo, wt);
    expect(r.status).toBe(0);
    expect(existsSync(sentinel)).toBe(true);
  });

  test("default `npm-link` with no source node_modules is a safe no-op", () => {
    const repo = makeRepo("npm-link"); // repo has no node_modules to mirror
    const wt = makeWorktree();
    const r = runProvision(repo, wt);
    expect(r.status).toBe(0);
    expect(existsSync(join(wt, "node_modules"))).toBe(false);
  });
});
