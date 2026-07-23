// libSQL / Turso client + one-time schema provisioning.
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { RESOURCES } from "./resources.mjs";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  throw new Error(
    "TURSO_DATABASE_URL is not set. Copy .env.example to .env and fill it in " +
      "(or export TURSO_DATABASE_URL / TURSO_AUTH_TOKEN).",
  );
}

export const db = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
  intMode: "number",
});

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

/**
 * Create tables/views + seed reference data the first time we connect to an
 * empty database (e.g. a fresh `file:` dev DB). Idempotent and cheap: if the
 * `contacts` table already exists we assume the schema is provisioned and skip.
 */
export async function initSchema() {
  const { rows } = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='contacts'",
  );
  if (rows.length > 0) return;

  const schema = readFileSync(join(repoRoot, "db", "schema.sql"), "utf8");
  await db.executeMultiple(schema);
  const seed = readFileSync(join(repoRoot, "db", "seed.sql"), "utf8");
  await db.executeMultiple(seed);
  // no-console only permits warn/error, so write the startup notice to stdout directly.
  process.stdout.write("Provisioned a fresh database (schema + seed).\n");
}

/** Actual column names per writable table, used to drop unknown keys on write. */
export const tableColumns = {};

export async function loadTableColumns() {
  for (const cfg of Object.values(RESOURCES)) {
    if (cfg.readonly) continue;
    const { rows } = await db.execute(`PRAGMA table_info("${cfg.table}")`);
    tableColumns[cfg.table] = rows.map((r) => r.name);
  }
}
