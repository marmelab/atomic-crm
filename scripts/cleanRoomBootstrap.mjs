#!/usr/bin/env node
// Builds the disposable e2e clean room: an empty Postgres carrying the
// ENVIRONMENT facts no migration can create for itself, then the
// deterministic migration chain replayed into it.
//
//   node scripts/cleanRoomBootstrap.mjs
//
// Invoked by `make start-supabase-e2e`. Disposable, idempotent, and
// non-interactive — it wipes .supabase-e2e and rebuilds from nothing every
// time, so a half-built clean room from a failed run cannot survive into
// the next one.
//
// Three things go in before the chain replays, all recorded under
// clean_room_prerequisites in supabase/migrations/replay-manifest.json:
//
//   pg_cron, pg_net      extensions a hosted project enables through the
//                        dashboard; `20260906070000` needs cron to exist.
//   cron_invoke_secret   a Vault secret `20260918130000` reads BY NAME. It
//                        fails closed rather than scheduling an
//                        unauthenticated call, which is correct, and means
//                        the clean room needs one of its own.
//
// The secret is generated fresh and at random on every run. MAIN's is never
// read, copied, or referenced — a throwaway environment gets a throwaway
// secret, and nothing here can leak one that matters.
//
// What does NOT belong here: anything about application objects. Grants,
// revokes, default privileges and RLS on application tables, sequences and
// functions are the repository's job, not the environment's — see
// `20260919175000_security_posture_is_deterministic.sql` and
// `20260920120000_security_posture_covers_sequences_and_functions.sql`. A
// clean room that needed a manual security step would not be a rebuild of
// MAIN; it would be a rebuild plus a step nobody wrote down, which is
// exactly the hole those two migrations closed.

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const WORKDIR = ".supabase-e2e";
const SUPA = path.join(REPO_ROOT, WORKDIR, "supabase");
const DB_CONTAINER = "supabase_db_atomic-crm-e2e";

const log = (message) => process.stderr.write(`[clean-room] ${message}\n`);

const run = (file, args, options = {}) =>
  execFileSync(file, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "inherit"],
    ...options,
  });

const psql = (sql) =>
  run(
    "docker",
    [
      "exec",
      "-i",
      DB_CONTAINER,
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    { input: sql },
  );

// ---------------------------------------------------------------------------
// 1. Wipe. A clean room that inherited anything would not be one.
// ---------------------------------------------------------------------------
log("wiping any previous instance");
try {
  run("npx", ["supabase", "stop", "--workdir", WORKDIR, "--no-backup"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
} catch {
  // Nothing was running. That is the normal case on a fresh machine.
}
rmSync(path.join(REPO_ROOT, WORKDIR, "supabase"), {
  recursive: true,
  force: true,
});
mkdirSync(path.join(SUPA, "migrations"), { recursive: true });

const copy = (from, to) =>
  cpSync(path.join(REPO_ROOT, "supabase", from), path.join(SUPA, to), {
    recursive: true,
  });

copy("config.e2e.toml", "config.toml");
for (const dir of ["schemas", "functions", "templates"]) copy(dir, dir);
copy("signing_keys.json", "signing_keys.json");

// The seed inserts into application tables, so it cannot run before the
// schema exists. It is applied at the end instead.
writeFileSync(path.join(SUPA, "seed.sql"), "");

// ---------------------------------------------------------------------------
// 2. Start an empty database, with no migrations to apply yet.
// ---------------------------------------------------------------------------
log("starting an empty database");
run("npx", ["supabase", "start", "--workdir", WORKDIR], {
  stdio: ["pipe", "pipe", "inherit"],
});

// ---------------------------------------------------------------------------
// 3. Environment prerequisites.
// ---------------------------------------------------------------------------
const manifest = JSON.parse(
  readFileSync(
    path.join(REPO_ROOT, "supabase/migrations/replay-manifest.json"),
    "utf8",
  ),
);
const prerequisites = manifest.clean_room_prerequisites;
const extensions = prerequisites.extensions;
const vaultSecrets = prerequisites.vault_secrets;

log(`extensions: ${extensions.join(", ")}`);
psql(
  extensions
    .map((name) => `create extension if not exists ${name};`)
    .join("\n"),
);

log(`vault secrets (freshly random, never MAIN's): ${vaultSecrets.join(", ")}`);
psql(
  vaultSecrets
    .map((name) => {
      const value = randomBytes(24).toString("hex");
      return `select vault.create_secret('${value}', '${name}', 'throwaway clean-room secret, generated at random; never MAIN''s');`;
    })
    .join("\n"),
);

// ---------------------------------------------------------------------------
// 4. Deterministic migrations only.
//
// MAIN-only historical repairs assert facts about real production rows and
// refuse on an empty database — correctly, which is how the first run of
// this script discovered they were being replayed at all. The list comes
// from the manifest, the same one replayBoundary.mjs audits, so there is no
// second hand-written set of skipped versions to drift.
// ---------------------------------------------------------------------------
copy("migrations", "migrations");
const mainOnly = new Set(
  manifest.main_only_historical_data_repairs.map((entry) =>
    typeof entry === "string" ? entry : (entry.version ?? entry.migration),
  ),
);
let excluded = 0;
for (const file of readdirSync(path.join(SUPA, "migrations"))) {
  if (mainOnly.has(file.split("_")[0])) {
    unlinkSync(path.join(SUPA, "migrations", file));
    excluded += 1;
  }
}
const deterministic = readdirSync(path.join(SUPA, "migrations")).filter(
  (file) => file.endsWith(".sql"),
).length;
log(`MAIN-only historical repairs excluded: ${excluded}`);
log(`deterministic migrations to replay:    ${deterministic}`);

log("replaying the deterministic chain");
run("npx", ["supabase", "migration", "up", "--workdir", WORKDIR, "--local"], {
  stdio: ["pipe", "pipe", "inherit"],
});

// ---------------------------------------------------------------------------
// 5. Seed, now that the tables it writes to exist.
// ---------------------------------------------------------------------------
log("seeding");
const seed = readFileSync(path.join(REPO_ROOT, "supabase/seed.sql"), "utf8");
psql(seed);
writeFileSync(path.join(SUPA, "seed.sql"), seed);

log("ready");
