// Apply db/schema.sql (and seed on first run) to the configured libSQL database.
//
// Usage:
//   node --env-file=.env db/apply-schema.mjs                 # uses TURSO_DATABASE_URL
//   TURSO_DATABASE_URL=file:./db/atomic-crm.local.db node db/apply-schema.mjs
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error(
    "TURSO_DATABASE_URL is not set (use --env-file=.env or export it).",
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

// This is a CLI tool: its whole job is to report progress to stdout. ESLint's
// no-console rule only permits warn/error, so write to stdout directly.
const print = (s) => process.stdout.write(s + "\n");

const schema = readFileSync(join(here, "schema.sql"), "utf8");
await client.executeMultiple(schema);
print(`Schema applied to ${url}`);

// Seed reference data only when the table is empty (idempotent).
const { rows } = await client.execute(
  "SELECT count(*) AS n FROM favicons_excluded_domains",
);
if (Number(rows[0].n) === 0) {
  const seed = readFileSync(join(here, "seed.sql"), "utf8");
  await client.executeMultiple(seed);
  print("Seed data inserted.");
} else {
  print("Seed skipped (favicons_excluded_domains already populated).");
}

client.close();
