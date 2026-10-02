// The gate run as a real hook against a stub npm registry. Spawned asynchronously:
// spawnSync would block the event loop the stub answers on.

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "dependency-gate.mjs");
const PINNED = "--ignore-scripts --min-release-age=21";
const UNREACHABLE = "http://127.0.0.1:1";

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

const pkg = ({
  created = 400,
  downloads = 500_000,
  manifest = {},
  advisories = [],
} = {}) => ({
  packument: {
    "dist-tags": { latest: "2.0.0" },
    time: { created: daysAgo(created), "2.0.0": daysAgo(created) },
    versions: { "2.0.0": { version: "2.0.0", ...manifest } },
  },
  downloads,
  advisories,
});

const REGISTRY = {
  "well-known": pkg(),
  "@scope/kit": pkg(),
  "brand-new": pkg({ created: 3 }),
  obscure: pkg({ downloads: 12 }),
  abandoned: pkg({ manifest: { deprecated: "use well-known instead" } }),
  "native-addon": pkg({
    manifest: { scripts: { install: "node-gyp rebuild" } },
  }),
  "gyp-addon": pkg({ manifest: { gypfile: true } }),
  vulnerable: pkg({
    advisories: [{ severity: "high", title: "Prototype pollution" }],
  }),
  "mildly-vulnerable": pkg({
    advisories: [{ severity: "moderate", title: "ReDoS" }],
  }),
  flaky: pkg(),
};

let server;
let registryUrl;
let tmp;
let flakyPackumentHits = 0;

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), "dependency-gate-"));
  server = createServer((req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const path = decodeURIComponent(req.url);
    if (
      req.method === "POST" &&
      path === "/-/npm/v1/security/advisories/bulk"
    ) {
      let body = "";
      req.on("data", (d) => (body += d));
      req.on("end", () => {
        const [name] = Object.keys(JSON.parse(body));
        send(200, { [name]: REGISTRY[name]?.advisories ?? [] });
      });
      return;
    }
    const downloads = path.match(/^\/downloads\/point\/last-week\/(.+)$/);
    const name = downloads ? downloads[1] : path.slice(1);
    const entry = REGISTRY[name];
    if (!entry) return send(404, { error: "not found" });
    if (name === "flaky" && !downloads && flakyPackumentHits++ === 0)
      return send(503, { error: "try again" });
    send(200, downloads ? { downloads: entry.downloads } : entry.packument);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  registryUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => {
  server.close();
  rmSync(tmp, { recursive: true, force: true });
});

const run = (
  command,
  { registry = registryUrl, cwd = tmp, appDir = tmp } = {},
) =>
  new Promise((resolve) => {
    const env = {
      ...process.env,
      npm_config_registry: registry,
      HARNESS_NPM_DOWNLOADS_API: registry,
      APP_DIR: appDir,
    };
    delete env.CLAUDE_PROJECT_DIR;
    delete env.CLAUDE_AGENT_NAME;
    const child = spawn("node", [HOOK], { env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => {
      const out = stdout.trim()
        ? JSON.parse(stdout.trim().split("\n").pop())
        : {};
      resolve({
        status,
        stderr,
        blocked: out.decision === "block" ? out.reason : null,
        command: out.hookSpecificOutput?.updatedInput?.command ?? null,
      });
    });
    child.stdin.end(
      JSON.stringify({
        tool_name: "Bash",
        session_id: "dependency-gate-test",
        cwd,
        tool_input: { command },
      }),
    );
  });

const project = (name, { dependencies = {}, bins = [] } = {}) => {
  const dir = join(tmp, name);
  mkdirSync(join(dir, "node_modules", ".bin"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies }));
  for (const bin of bins)
    writeFileSync(join(dir, "node_modules", ".bin", bin), "");
  return dir;
};

const configured = (name, dependencies) => {
  const dir = join(tmp, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "harness.config.json"),
    JSON.stringify({ dependencies }),
  );
  return dir;
};

describe("dependency-gate", () => {
  describe("lets a vetted package through, pinned", () => {
    test("adds the pinned flags right after the install subcommand", async () => {
      const r = await run("npm install well-known");
      expect(r.blocked).toBeNull();
      expect(r.command).toBe(`npm install ${PINNED} well-known`);
    });

    test("pins every install of a compound command and leaves the rest alone", async () => {
      const r = await run(
        "cd /tmp && npm i -D well-known @scope/kit 2>&1 | tail -3 && npm add well-known",
      );
      expect(r.command).toBe(
        `cd /tmp && npm i ${PINNED} -D well-known @scope/kit 2>&1 | tail -3 && npm add ${PINNED} well-known`,
      );
    });

    test("pins an npx run that fetches its package", async () => {
      const r = await run("npx -y well-known@2.0.0 --help");
      expect(r.command).toBe(`npx ${PINNED} -y well-known@2.0.0 --help`);
    });

    test("a moderate advisory does not refuse the package", async () => {
      const r = await run("npm install mildly-vulnerable");
      expect(r.command).toBe(`npm install ${PINNED} mildly-vulnerable`);
    });

    test("a range skips the version checks but is still pinned to --ignore-scripts", async () => {
      const r = await run("npm install native-addon@^2");
      expect(r.command).toBe(`npm install ${PINNED} native-addon@^2`);
    });
  });

  describe("needs no registry for what the project already has", () => {
    test("a package declared in package.json is pinned without being vetted", async () => {
      const dir = project("declared", { dependencies: { obscure: "^1.0.0" } });
      const r = await run(`cd ${dir} && npm install obscure@2.0.0`, {
        registry: UNREACHABLE,
      });
      expect(r.command).toBe(
        `cd ${dir} && npm install ${PINNED} obscure@2.0.0`,
      );
    });

    test("an npx command that resolves to a local bin is left untouched", async () => {
      const dir = project("local-bin", { bins: ["prettier"] });
      const r = await run(`cd ${dir} && npx prettier --check .`, {
        registry: UNREACHABLE,
      });
      expect(r).toMatchObject({ blocked: null, command: null });
    });

    test.each([
      "git status",
      "npm install",
      "npm ci",
      "npm run build",
      'echo "npm install x"',
    ])("`%s` is left untouched", async (command) => {
      const r = await run(command, { registry: UNREACHABLE });
      expect(r).toMatchObject({ status: 0, blocked: null, command: null });
    });
  });

  describe("refuses what fails the vetting", () => {
    test.each([
      ["hallucinated-name", "does not exist on the npm registry"],
      ["brand-new", "first published less than 21 days ago"],
      ["obscure", "12 downloads a week"],
      ["abandoned", "deprecated: use well-known instead"],
      ["native-addon", "runs an install script (`install`)"],
      ["gyp-addon", "runs an install script (`node-gyp`)"],
      ["vulnerable", "high security advisory: Prototype pollution"],
      ["well-known@9.9.9", "no published version or tag `9.9.9`"],
    ])("`npm install %s`", async (spec, why) => {
      const r = await run(`npm install ${spec}`);
      expect(r.blocked).toContain(why);
      expect(r.blocked).toContain("build the feature without the package");
    });

    test("one refused package refuses the whole command", async () => {
      const r = await run("npm install well-known brand-new");
      expect(r.blocked).toContain("`brand-new`");
      expect(r.blocked).not.toContain("`well-known`");
    });

    test("a transient registry error is retried once", async () => {
      const r = await run("npm install flaky");
      expect(r.command).toBe(`npm install ${PINNED} flaky`);
    });

    test("an unreachable registry refuses rather than lets the install run unvetted", async () => {
      const r = await run("npm install well-known", { registry: UNREACHABLE });
      expect(r.blocked).toContain("could not reach the npm registry");
    });
  });

  describe("refuses what would bypass the vetting", () => {
    test.each([
      "pnpm add zod",
      "yarn add zod",
      "bun add zod",
      "bunx cowsay",
      "pnpm dlx create-vite",
    ])("`%s`", async (command) => {
      const r = await run(command, { registry: UNREACHABLE });
      expect(r.blocked).toContain("installs are not vetted, only npm's are");
    });

    test.each([
      "github:user/repo",
      "./local-pkg",
      "https://example.com/pkg.tgz",
      "alias@npm:zod",
    ])("the non-registry spec `%s`", async (spec) => {
      const r = await run(`npm install ${spec}`, { registry: UNREACHABLE });
      expect(r.blocked).toContain("is not a plain registry package");
    });

    test.each([
      "--min-release-age=0",
      "--registry https://evil.example",
      "--no-ignore-scripts",
    ])("the gate-owned flag `%s`", async (flag) => {
      const r = await run(`npm install well-known ${flag}`, {
        registry: UNREACHABLE,
      });
      expect(r.blocked).toContain("would bypass the vetting");
    });
  });

  describe("a project tunes the policy in harness.config.json", () => {
    test("a lower download floor lets a smaller package through", async () => {
      const appDir = configured("low-floor", { minWeeklyDownloads: 10 });
      const r = await run("npm install obscure", { appDir });
      expect(r.command).toBe(`npm install ${PINNED} obscure`);
    });

    test("a shorter release age lets a newer package through and pins npm to it", async () => {
      const appDir = configured("short-age", { minReleaseAgeDays: 2 });
      const r = await run("npm install brand-new", { appDir });
      expect(r.command).toBe(
        "npm install --ignore-scripts --min-release-age=2 brand-new",
      );
    });

    test("only the listed severities refuse a package", async () => {
      const appDir = configured("critical-only", {
        blockingSeverities: ["critical"],
      });
      const r = await run("npm install vulnerable", { appDir });
      expect(r.command).toBe(`npm install ${PINNED} vulnerable`);
    });

    test("an approved name or scope skips the vetting, still pinned", async () => {
      const appDir = configured("approved", {
        allow: ["native-addon", "@acme/*"],
      });
      const r = await run("npm install native-addon @acme/private-kit", {
        appDir,
        registry: UNREACHABLE,
      });
      expect(r.command).toBe(
        `npm install ${PINNED} native-addon @acme/private-kit`,
      );
    });

    test("an invalid block falls back to the defaults, it never loosens them", async () => {
      const appDir = configured("invalid", { minWeeklyDownloads: "lots" });
      const r = await run("npm install obscure", { appDir });
      expect(r.blocked).toContain("12 downloads a week (minimum 1000)");
    });
  });
});
