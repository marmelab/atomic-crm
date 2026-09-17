// Gate A baseline fidelity proof: compares the DISPOSABLE project's
// writer-relevant tables against the read-only MAIN export, row by row and
// column by column (not just counts). Emits the comparison SQL to run
// against the disposable project, and verifies the returned rows match the
// MAIN export exactly. Real data stays in the gitignored data/ tree.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.join(__dirname, "data", "baseline");

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

function readExport(file) {
  const txt = fs.readFileSync(file, "utf8");
  const parsed = JSON.parse(txt.slice(txt.indexOf("{")));
  return parsed.rows[0].rows ?? [];
}

const mode = process.argv[2];

if (mode === "emit") {
  // One query per table, id-ordered, so the comparison is deterministic.
  const parts = TABLES.map(
    (t) =>
      `select '${t}' as tbl, coalesce(json_agg(x order by x.id), '[]'::json) as rows from ${t} x`,
  );
  fs.writeFileSync(
    path.join(__dirname, "data", "baseline_compare.sql"),
    parts.join("\nunion all\n") + ";",
  );
  // eslint-disable-next-line no-console
  console.log("emitted baseline_compare.sql");
  process.exit(0);
}

// mode === "compare <disposableResultFile>"
const disposableRaw = fs.readFileSync(process.argv[3], "utf8");
const disposableParsed = JSON.parse(
  disposableRaw.slice(disposableRaw.indexOf("{")),
);
const actualByTable = {};
for (const row of disposableParsed.rows)
  actualByTable[row.tbl] = row.rows ?? [];

const report = [];
let totalMismatches = 0;

// The disposable project legitimately holds ONE row MAIN does not: the
// proposed "Growing Yourself Up — January 2027" Cohort, created by the
// undeployed Phase 4 migration under test. It is expected extra state, not
// a baseline infidelity — asserted explicitly rather than tolerated by a
// loose comparison.
const EXPECTED_EXTRA = {
  cohorts: (row) => row.name === "Growing Yourself Up — January 2027",
};

for (const table of TABLES) {
  const expected = readExport(path.join(BASE, `${table}.raw.json`))
    .slice()
    .sort((a, b) => a.id - b.id);
  const expectedIds = new Set(expected.map((r) => r.id));
  let actual = (actualByTable[table] ?? []).slice().sort((a, b) => a.id - b.id);
  let mismatches = 0;
  const reasons = [];

  if (EXPECTED_EXTRA[table]) {
    const extras = actual.filter((r) => !expectedIds.has(r.id));
    for (const extra of extras) {
      if (!EXPECTED_EXTRA[table](extra)) {
        mismatches++;
        reasons.push(`unexpected extra row id=${extra.id}`);
      }
    }
    actual = actual.filter((r) => expectedIds.has(r.id));
  }

  if (expected.length !== actual.length) {
    mismatches++;
    reasons.push(`row-count ${expected.length} vs ${actual.length}`);
  }
  for (let i = 0; i < Math.min(expected.length, actual.length); i++) {
    const e = expected[i];
    const a = actual[i];
    for (const col of Object.keys(e)) {
      const ev = JSON.stringify(e[col] ?? null);
      const av = JSON.stringify(a[col] ?? null);
      if (ev !== av) {
        mismatches++;
        if (reasons.length < 5) reasons.push(`id=${e.id} col=${col}`);
      }
    }
  }
  totalMismatches += mismatches;
  report.push({
    table,
    expectedRows: expected.length,
    actualRows: actual.length,
    mismatches,
    reasons,
  });
}

// eslint-disable-next-line no-console
console.log(JSON.stringify({ totalMismatches, tables: report }, null, 2));
process.exit(totalMismatches === 0 ? 0 : 1);
