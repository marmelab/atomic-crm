import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "ensure-playwright-mcp.mjs");

let TMP;

const makeRepo = ({ mcpCli = false, chromiumAt = null } = {}) => {
  const repo = mkdtempSync(join(TMP, "repo-"));
  writeFileSync(join(repo, "package.json"), '{"name":"fixture"}');
  if (mcpCli) {
    const mcp = join(repo, "node_modules", "@playwright", "mcp");
    mkdirSync(mcp, { recursive: true });
    writeFileSync(join(mcp, "cli.js"), "");
  }
  if (chromiumAt) {
    const core = join(repo, "node_modules", "playwright-core");
    mkdirSync(core, { recursive: true });
    writeFileSync(
      join(core, "package.json"),
      '{"name":"playwright-core","version":"0.0.0-fixture","main":"index.js"}',
    );
    writeFileSync(
      join(core, "index.js"),
      `module.exports = { chromium: { executablePath: () => ${JSON.stringify(chromiumAt)} } };`,
    );
  }
  return repo;
};

const run = (repo) =>
  spawnSync("node", [HOOK], {
    input: JSON.stringify({
      session_id: "pw-mcp-1234",
      hook_event_name: "SessionStart",
    }),
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: repo,
      PLAYWRIGHT_MCP_CHECK_ONLY: "1",
    },
    encoding: "utf8",
  });

const warns = (r) => r.stdout.includes("playwright-mcp-status");

beforeAll(() => {
  TMP = mkdtempSync(join(tmpdir(), "ensure-pw-mcp-"));
});

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe("ensure-playwright-mcp", () => {
  test("warns when the MCP package is absent", () => {
    const r = run(makeRepo());
    expect(r.status).toBe(0);
    expect(warns(r)).toBe(true);
  });

  test("warns when the package is present but Chromium cannot be resolved", () => {
    const r = run(makeRepo({ mcpCli: true }));
    expect(r.status).toBe(0);
    expect(warns(r)).toBe(true);
  });

  test("warns when Chromium resolves to a path that does not exist", () => {
    const r = run(
      makeRepo({ mcpCli: true, chromiumAt: "/nonexistent/chrome" }),
    );
    expect(r.status).toBe(0);
    expect(warns(r)).toBe(true);
  });

  test("stays silent when the package and the Chromium binary are both present", () => {
    const existingBinary = process.execPath;
    const r = run(makeRepo({ mcpCli: true, chromiumAt: existingBinary }));
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("");
  });
});
