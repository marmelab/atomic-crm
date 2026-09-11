// Tests for restrict-documentator-bash.mjs. The documentator writes to MEMORY.md on
// the base branch, so its Bash surface is a read-only + commit-MEMORY.md whitelist.
// Blocks are exit 2 + stderr (ctx.error), not decision JSON. It must fail CLOSED: a
// malformed payload blocks, since an uncaught throw (exit 1) would let the command run.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "restrict-documentator-bash.mjs");
const TMP = mkdtempSync(join(tmpdir(), "restrict-doc-bash-"));
const REPO = "/workspaces/app";

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

const run = (command, { via = "agent_type", raw = null } = {}) => {
  const env = { ...process.env, APP_DIR: TMP };
  delete env.DOCUMENTATOR_RUN;
  delete env.CLAUDE_AGENT_NAME;
  if (via === "env") env.DOCUMENTATOR_RUN = "1";
  const payload = JSON.stringify({
    tool_name: "Bash",
    session_id: "doc-1234",
    agent_type: via === "agent_type" ? "documentator" : "",
    tool_input: { command },
  });
  return spawnSync("node", [HOOK], {
    input: raw ?? payload,
    env,
    encoding: "utf8",
  });
};

const blocked = (r) => r.status === 2;

describe("restrict-documentator-bash", () => {
  const ALLOWED = [
    "git log --oneline -20",
    "git show HEAD",
    "git diff HEAD~1",
    `git -C ${REPO} diff --stat main..session/abcd1234`,
    `git -C ${REPO} log --oneline -5`,
    "ls adr/",
    "wc -l MEMORY.md",
    `git -C ${REPO} add MEMORY.md`,
    `git -C ${REPO} -c user.name=Documentator -c user.email=documentator@harness.local commit -m "docs: capture"`,
    `git -C ${REPO} -c user.email=documentator@harness.local -c user.name=Documentator commit -m "docs: capture"`,
  ];

  test.each(ALLOWED)("'%s' → allowed", (cmd) => {
    expect(run(cmd).status).toBe(0);
  });

  const REFUSED = [
    "rm -rf src",
    "npm install lodash",
    `git -C ${REPO} push origin main`,
    `git -C ${REPO} add src/App.tsx`,
    "git commit -m 'sneaky'", // no pinned author identity
    `git -C ${REPO} -c user.name=Someone -c user.email=someone@evil.test commit -m "x"`,
  ];

  test.each(REFUSED)("'%s' → blocked", (cmd) => {
    const r = run(cmd);
    expect(blocked(r)).toBe(true);
    expect(r.stderr).toContain("documentator");
  });

  // Metacharacters are rejected BEFORE the whitelist, so a permitted prefix cannot
  // smuggle a second command past it.
  const SMUGGLING = [
    "git log; rm -rf /",
    "git log && npm publish",
    "git log | tee /tmp/x",
    "git log `whoami`",
    "git log $(id)",
    "git log > /tmp/out",
    "git log\nrm -rf src",
  ];

  test.each(SMUGGLING)("'%s' → blocked as a metacharacter", (cmd) => {
    const r = run(cmd);
    expect(blocked(r)).toBe(true);
    expect(r.stderr).toContain("metacharacters");
  });

  test("recognised via DOCUMENTATOR_RUN=1 as well as agent_type", () => {
    expect(run("rm -rf src", { via: "env" }).status).toBe(2);
    expect(run("git log", { via: "env" }).status).toBe(0);
  });

  test("any other agent passes through untouched", () => {
    const r = spawnSync("node", [HOOK], {
      input: JSON.stringify({
        tool_name: "Bash",
        session_id: "doc-1234",
        agent_type: "developer",
        tool_input: { command: "rm -rf src" },
      }),
      env: { ...process.env, APP_DIR: TMP },
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
  });

  // This hook runs on EVERY caller's Bash, so identity is what decides. Once the
  // caller is known to be the documentator (env var, independent of the payload) a
  // malformed payload blocks. When identity is only knowable FROM the payload, it has
  // to pass through: blocking would refuse every agent's Bash for the whole run.
  test("an unparseable payload fails CLOSED when identity comes from the env", () => {
    expect(run("", { via: "env", raw: "not json" }).status).toBe(2);
  });

  test("an unparseable payload passes through when identity is unknowable", () => {
    expect(run("", { raw: "not json" }).status).toBe(0);
  });

  test("an empty command is blocked", () => {
    expect(run("").status).toBe(2);
  });
});
