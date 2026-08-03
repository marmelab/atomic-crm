// Tests for .claude/scripts/pending-deploys.mjs: decides whether a session has
// deploy-relevant changes worth a migration round. Config-driven:
// the round exists iff config.deploy is present, and relevance comes from
// config.deploy.relevantGlobs (one definition, unified with the orchestrator's
// SIMPLE-review gate).
import { describe, test, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { globToRegexSource, relevanceRegex } from "../pending-deploys.mjs";

const SCRIPT = new URL("../pending-deploys.mjs", import.meta.url).pathname;

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd }).toString();
}

// A repo with a Supabase deploy adapter configured (so the deploy gate is open),
// a declarative schema file, and the session topology branches.
function setupRepo({ deploy = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "pd-"));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@t.t");
  git(dir, "config", "user.name", "t");
  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "supabase/schemas"), { recursive: true });
  mkdirSync(join(dir, "supabase/migrations"), { recursive: true });
  writeFileSync(
    join(dir, "src/types.ts"),
    "export type Contact = { id: string };\n",
  );
  writeFileSync(
    join(dir, "supabase/schemas/01_tables.sql"),
    "create table contacts (id uuid primary key);\n",
  );
  const config = { validation: { steps: [] }, roles: {} };
  if (deploy)
    config.deploy = { adapter: "supabase", relevantGlobs: ["supabase/**"] };
  writeFileSync(join(dir, "harness.config.json"), JSON.stringify(config));
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "seed");
  git(dir, "branch", "session-base/ab12cd34", "main");
  git(dir, "branch", "session/ab12cd34", "main");
  return dir;
}

const run = (dir, ...args) =>
  execFileSync("node", [SCRIPT, "--app", dir, ...args])
    .toString()
    .trim();

describe("pending-deploys relevance", () => {
  test("globToRegexSource anchors and expands ** / *", () => {
    expect(globToRegexSource("supabase/**")).toBe("^supabase/.*");
    expect(globToRegexSource("**/types.ts")).toBe("^(?:.*/)?types\\.ts");
  });

  test("relevanceRegex matches configured paths, not others", () => {
    const re = relevanceRegex(["supabase/**"]);
    expect(re.test("supabase/schemas/01_tables.sql")).toBe(true);
    expect(re.test("src/types.ts")).toBe(false);
    expect(relevanceRegex([]).test("supabase/schemas/x.sql")).toBe(false);
  });
});

describe("pending-deploys", () => {
  test("empty when session branch made no deploy-relevant change", () => {
    const dir = setupRepo();
    expect(run(dir, "--session", "ab12cd34")).toBe("");
    rmSync(dir, { recursive: true, force: true });
  });

  test("non-empty when the session branch changes the declarative schema", () => {
    const dir = setupRepo();
    git(dir, "checkout", "-q", "session/ab12cd34");
    writeFileSync(
      join(dir, "supabase/schemas/01_tables.sql"),
      "create table contacts (id uuid primary key, priority int);\n",
    );
    git(dir, "add", ".");
    git(dir, "commit", "-qm", "add priority column");
    git(dir, "checkout", "-q", "main");
    expect(run(dir, "--session", "ab12cd34")).not.toBe("");
    rmSync(dir, { recursive: true, force: true });
  });

  test("a TS-only change (no schema file) is NOT deploy-relevant (unified definition)", () => {
    const dir = setupRepo();
    git(dir, "checkout", "-q", "session/ab12cd34");
    writeFileSync(
      join(dir, "src/types.ts"),
      "export type Contact = { id: string; priority: number };\n",
    );
    git(dir, "add", ".");
    git(dir, "commit", "-qm", "add priority to type only");
    git(dir, "checkout", "-q", "main");
    expect(run(dir, "--session", "ab12cd34")).toBe("");
    rmSync(dir, { recursive: true, force: true });
  });

  test("no config.deploy -> exit 0 empty (deploy phase not configured)", () => {
    const dir = setupRepo({ deploy: false });
    git(dir, "checkout", "-q", "session/ab12cd34");
    writeFileSync(
      join(dir, "supabase/schemas/01_tables.sql"),
      "create table contacts (id uuid primary key, x int);\n",
    );
    git(dir, "add", ".");
    git(dir, "commit", "-qm", "schema change but no deploy adapter");
    git(dir, "checkout", "-q", "main");
    expect(run(dir, "--session", "ab12cd34")).toBe("");
    rmSync(dir, { recursive: true, force: true });
  });

  test("empty and exit 0 when NO session topology exists at all (hooks never ran)", () => {
    const dir = mkdtempSync(join(tmpdir(), "pd-"));
    git(dir, "init", "-q", "-b", "main");
    git(dir, "config", "user.email", "t@t.t");
    git(dir, "config", "user.name", "t");
    writeFileSync(join(dir, "x.ts"), "export const x = 1;\n");
    writeFileSync(
      join(dir, "harness.config.json"),
      JSON.stringify({
        validation: { steps: [] },
        roles: {},
        deploy: { adapter: "supabase", relevantGlobs: ["supabase/**"] },
      }),
    );
    git(dir, "add", ".");
    git(dir, "commit", "-qm", "seed");
    expect(run(dir, "--session", "xx99yy00")).toBe("");
    rmSync(dir, { recursive: true, force: true });
  });

  test("exits 3 (could not decide) when --session is missing", () => {
    const dir = setupRepo();
    let code = 0,
      stderr = "";
    try {
      execFileSync("node", [SCRIPT, "--app", dir], {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (e) {
      code = e.status;
      stderr = (e.stderr || "").toString();
    }
    expect(code).toBe(3);
    expect(stderr).toMatch(/session/i);
    rmSync(dir, { recursive: true, force: true });
  });

  test("fails loudly (exit 3 + stderr) on SESSION_SHORT_ID mismatch", () => {
    const dir = setupRepo();
    let code = 0,
      stderr = "";
    try {
      execFileSync("node", [SCRIPT, "--app", dir, "--session", "xx99yy00"], {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (e) {
      code = e.status;
      stderr = (e.stderr || "").toString();
    }
    expect(code).toBe(3);
    expect(stderr).toMatch(/mismatch/i);
    rmSync(dir, { recursive: true, force: true });
  });
});
