// Tests for .claude/scripts/pending-deploys.mjs — decides whether a session has
// schema-relevant changes worth a migration round.
import { describe, test, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = new URL("../pending-deploys.mjs", import.meta.url).pathname;

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd }).toString();
}

function setupRepo() {
  const dir = mkdtempSync(join(tmpdir(), "pd-"));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@t.t");
  git(dir, "config", "user.name", "t");
  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "supabase/migrations"), { recursive: true });
  writeFileSync(
    join(dir, "src/types.ts"),
    "export type Contact = { id: string };\n",
  );
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "seed");
  git(dir, "branch", "session-base/ab12cd34", "main");
  git(dir, "branch", "session/ab12cd34", "main");
  return dir;
}

describe("pending-deploys", () => {
  test("empty when session branch made no schema-relevant change", () => {
    const dir = setupRepo();
    const out = execFileSync("node", [
      SCRIPT,
      "--app",
      dir,
      "--session",
      "ab12cd34",
    ])
      .toString()
      .trim();
    expect(out).toBe("");
    rmSync(dir, { recursive: true, force: true });
  });

  test("non-empty when the session branch adds an entity field", () => {
    const dir = setupRepo();
    git(dir, "checkout", "-q", "session/ab12cd34");
    writeFileSync(
      join(dir, "src/types.ts"),
      "export type Contact = { id: string; priority: number };\n",
    );
    git(dir, "add", ".");
    git(dir, "commit", "-qm", "add priority");
    git(dir, "checkout", "-q", "main");
    const out = execFileSync("node", [
      SCRIPT,
      "--app",
      dir,
      "--session",
      "ab12cd34",
    ])
      .toString()
      .trim();
    expect(out).not.toBe("");
    rmSync(dir, { recursive: true, force: true });
  });

  test("empty and exit 0 when NO session topology exists at all (hooks never ran)", () => {
    const dir = mkdtempSync(join(tmpdir(), "pd-"));
    git(dir, "init", "-q", "-b", "main");
    git(dir, "config", "user.email", "t@t.t");
    git(dir, "config", "user.name", "t");
    writeFileSync(join(dir, "x.ts"), "export const x = 1;\n");
    git(dir, "add", ".");
    git(dir, "commit", "-qm", "seed");
    // No session-base/* branches at all.
    const out = execFileSync("node", [
      SCRIPT,
      "--app",
      dir,
      "--session",
      "xx99yy00",
    ])
      .toString()
      .trim();
    expect(out).toBe("");
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
    const dir = setupRepo(); // creates session-base/ab12cd34 + session/ab12cd34
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
