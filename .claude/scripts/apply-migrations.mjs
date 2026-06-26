#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
//  apply-migrations — Apply committed migrations to the local
//  Supabase instance.
//
//  Usage:
//    node apply-migrations.mjs
//
//  Behaviour:
//    Migrations are already committed to supabase/migrations/ on
//    the base branch (written by the deploy-time migration round and
//    merged by the merger) before this script runs. There is nothing
//    to promote — this script only applies what is already there.
//
//    If Supabase is not running: start it (initial start applies
//    every migration in supabase/migrations/).
//    If Supabase is already running: run `npx supabase migration up`.
//
//    After applying, the PostgREST schema cache is reloaded so
//    new columns/tables are visible immediately.
//
//  Portability (works on both crm-builder and a bare AtomicCRM checkout):
//    APP_DIR  — repo root. Defaults to $CLAUDE_PROJECT_DIR, then /app.
//    Migrations are always applied regardless of the app's data mode:
//    crm-builder runs in demo (FakeRest) by default at migration time,
//    but the committed migrations must still land in local Supabase so
//    they are ready when the app is switched to live data. The demo|full
//    MODE distinction belongs only to the live-switch step, not here.
//    Supabase is driven via the `supabase` CLI, which manages its own
//    Docker containers — we do NOT gate on /var/run/docker.sock so the
//    same script works wherever the CLI is available (e.g. `make`).
// ─────────────────────────────────────────────────────────────
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

// Resolve the repo root robustly. Prefer an explicit override / the env var, then
// the git toplevel — works on any surface (local, devcontainer, CRM Builder)
// without relying on CLAUDE_PROJECT_DIR being EXPORTED to this node process. The
// old "/app" hardcoded fallback was a CRM-Builder-ism: on a bare checkout where the
// env var wasn't exported, it chdir'd into a non-writable /app → EACCES on mkdir.
// git is only spawned as the fallback — when an env var is set (the common harness
// case) we never shell out.
const gitToplevel = () => {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  });
  return (r.status === 0 && r.stdout.trim()) || "";
};
const APP_DIR =
  process.env.APP_DIR ||
  process.env.CLAUDE_PROJECT_DIR ||
  gitToplevel() ||
  process.cwd();

const GREEN = "\x1b[0;32m";
const YELLOW = "\x1b[1;33m";
const RED = "\x1b[0;31m";
const BOLD = "\x1b[1m";
const NC = "\x1b[0m";

const log = (msg) => process.stdout.write(`${msg}\n`);
const err = (msg) => process.stderr.write(`${msg}\n`);

process.chdir(APP_DIR);
mkdirSync("supabase/migrations", { recursive: true });

// Run a command, capturing combined stdout+stderr as text.
function run(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: "utf8" });
  const out = (res.stdout || "") + (res.stderr || "");
  return { out, code: res.status ?? (res.error ? 1 : 0) };
}

async function isSupabaseUp() {
  try {
    await fetch("http://localhost:54321", {
      signal: AbortSignal.timeout(2000),
    });
    return true;
  } catch {
    return false;
  }
}

function reloadSchemaCache() {
  const { code } = run("npx", [
    "supabase",
    "db",
    "query",
    "--local",
    "SELECT pg_notify('pgrst', 'reload schema');",
  ]);
  if (code === 0) {
    log(`${GREEN}PostgREST schema cache reloaded.${NC}`);
  } else {
    log(`${YELLOW}Could not reload PostgREST schema cache (non-fatal).${NC}`);
  }
}

if (await isSupabaseUp()) {
  // ── Apply migrations to running Supabase ──
  log(`${BOLD}Applying pending migrations to running Supabase...${NC}`);
  let { out, code } = run("npx", ["supabase", "migration", "up", "--local"]);

  if (code !== 0) {
    // Auto-repair phantom versions that are recorded in Supabase but absent from
    // the local migrations/ directory (happens when a prior session's worktree was
    // cleaned up after applying the migration but before it landed in git).
    if (
      out.includes(
        "Remote migration versions not found in local migrations directory",
      )
    ) {
      const phantomVersions = [...new Set(out.match(/\d{14}/g) ?? [])];
      if (phantomVersions.length > 0) {
        log(
          `${YELLOW}Auto-repairing phantom migration versions: ${phantomVersions.join(" ")}${NC}`,
        );
        run("npx", [
          "supabase",
          "migration",
          "repair",
          "--local",
          "--status",
          "reverted",
          ...phantomVersions,
        ]);
        ({ out, code } = run("npx", [
          "supabase",
          "migration",
          "up",
          "--local",
        ]));
      }
    }
    if (code !== 0) {
      err(out);
      err(`${RED}Migration up failed.${NC}`);
      process.exit(1);
    }
  }
  log(`${GREEN}Migrations applied.${NC}`);
  reloadSchemaCache();
} else {
  // ── Initial start applies all migrations ──
  log(
    `${BOLD}Starting Supabase (initial start applies all migrations)...${NC}`,
  );
  log(`${YELLOW}First run can take up to ~2 min to pull images.${NC}`);
  const { out } = run("npx", ["supabase", "start"]);
  for (const line of out.split("\n")) {
    if (/✓|✗|Error|Started|API URL/.test(line)) log(line);
  }

  log(`${BOLD}Waiting for Supabase API (localhost:54321)...${NC}`);
  let retries = 120;
  while (!(await isSupabaseUp())) {
    retries -= 1;
    if (retries <= 0) {
      err(`${RED}Supabase did not respond after 120s.${NC}`);
      process.exit(1);
    }
    await sleep(1000);
  }
  log(`${GREEN}Supabase ready and all migrations applied.${NC}`);
  reloadSchemaCache();
}
