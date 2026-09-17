// Gate A baseline loader — generates the SQL that reproduces MAIN's
// writer-relevant pre-import state inside the DISPOSABLE project only.
// Reads the gitignored read-only exports in data/baseline/, preserves real
// primary keys (the writer's idempotency/UPDATE paths depend on them), and
// runs the whole load under migration mode so replicating existing state
// never fires live business triggers (a stage='won' Deal would otherwise
// spawn an Enrollment + onboarding Tasks that MAIN doesn't have).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.join(__dirname, "data", "baseline");

// Order matters: FK parents before children.
const TABLES = [
  "sales",
  "cohorts",
  "contacts",
  "deals",
  "applications",
  "waitlist_entries",
  "enrollments",
  "sales_calls",
  "client_sessions",
  "deal_stage_events",
  "enrollment_status_events",
  "enrollment_onboarding_items",
  "tasks",
];

function readRows(table) {
  const txt = fs.readFileSync(path.join(BASE, `${table}.raw.json`), "utf8");
  const parsed = JSON.parse(txt.slice(txt.indexOf("{")));
  return parsed.rows[0].rows ?? [];
}

// Real column types, read live from information_schema — a JS array is
// ambiguous on its own (contacts.email_jsonb is jsonb, contacts.tags is
// bigint[]), so the destination type decides the literal form rather than a
// guess based on the value's shape.
const colTypes = (() => {
  const txt = fs.readFileSync(path.join(BASE, "_coltypes.raw.json"), "utf8");
  const parsed = JSON.parse(txt.slice(txt.indexOf("{")));
  const map = {};
  for (const r of parsed.rows[0].rows)
    map[`${r.table_name}.${r.column_name}`] = r.data_type;
  return map;
})();

function lit(v, table, col) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (colTypes[`${table}.${col}`] === "ARRAY") {
    return `'{${(Array.isArray(v) ? v : [v]).join(",")}}'`;
  }
  if (typeof v === "object")
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

const statements = ["begin;", "select set_historical_migration_mode(true);"];
const expected = {};

for (const table of TABLES) {
  const rows = readRows(table);
  expected[table] = rows.length;
  for (const row of rows) {
    const cols = Object.keys(row);
    // Upsert rather than plain insert: the disposable project's own
    // auth.users -> sales sync trigger already materializes a `sales` row,
    // and an idempotent baseline load is strictly better for a repeatable
    // proof than one that only works against a pristine database.
    const updates = cols
      .filter((c) => c !== "id")
      .map((c) => `"${c}" = excluded."${c}"`);
    const conflict = updates.length
      ? `on conflict (id) do update set ${updates.join(", ")}`
      : "on conflict (id) do nothing";
    statements.push(
      `insert into ${table} (${cols.map((c) => `"${c}"`).join(", ")}) values (${cols.map((c) => lit(row[c], table, c)).join(", ")}) ${conflict};`,
    );
  }
}

// Re-align every identity sequence past the loaded real ids, so the
// historical import that follows never collides with a baseline row.
for (const table of TABLES) {
  statements.push(
    `select setval(pg_get_serial_sequence('${table}', 'id'), coalesce((select max(id) from ${table}), 0) + 1, false);`,
  );
}

statements.push("select set_historical_migration_mode(false);", "commit;");

fs.writeFileSync(
  path.join(__dirname, "data", "baseline_load.sql"),
  statements.join("\n"),
);
fs.writeFileSync(
  path.join(__dirname, "data", "baseline_expected.json"),
  JSON.stringify(expected, null, 2),
);
// eslint-disable-next-line no-console
console.log(
  JSON.stringify({ statementCount: statements.length, expected }, null, 2),
);
