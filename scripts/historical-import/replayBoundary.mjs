// The line between "rebuilds a database" and "repairs this one".
//
// Schema and deterministic configuration must reconstruct from this
// repository into an empty database — that is the disaster-recovery
// property the project actually needs. Historical data repairs correct
// specific real records on MAIN; replaying them into an empty database is
// meaningless, and the assertions that make them trustworthy there would
// have to be gutted to make them pass.
//
// So they are listed in replay-manifest.json rather than weakened.
// Everything absent from that file is deterministic and must replay.
//
// The trap this module exists to catch: a migration that repairs data AND
// creates structure. Skipping one of those leaves the rebuilt database
// quietly missing a column, a trigger or an index, and nothing would say
// so until something failed much later.

import { readFileSync, readdirSync } from "node:fs";

export const MIGRATIONS_DIR = new URL(
  "../../supabase/migrations/",
  import.meta.url,
);

export const readManifest = () =>
  JSON.parse(
    readFileSync(new URL("replay-manifest.json", MIGRATIONS_DIR), "utf8"),
  );

export const listMigrationFiles = () =>
  readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

/** Strip line comments, so prose about a person is not read as a repair. */
export const stripComments = (sql) =>
  sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

/**
 * Durable structure a migration may own.
 *
 * Deliberately a list of obvious shapes rather than a SQL parser: the goal
 * is catching a boundary violation somebody did not notice, not proving
 * semantics. A temporary helper created and dropped inside one repair is
 * not durable and is not looked for here.
 */
export const DURABLE_DDL = [
  [/create\s+table\s/i, "create table"],
  [/alter\s+table[^;]*\badd\s+column\b/i, "add column"],
  [/alter\s+table[^;]*\badd\s+constraint\b/i, "add constraint"],
  [/alter\s+table[^;]*\balter\s+column\b/i, "alter column"],
  [/create\s+(?:unique\s+)?index/i, "create index"],
  [/create\s+(?:or\s+replace\s+)?function/i, "create function"],
  [/create\s+trigger/i, "create trigger"],
  [/create\s+(?:or\s+replace\s+)?view/i, "create view"],
  [/create\s+policy/i, "create policy"],
  [/alter\s+table[^;]*enable\s+row\s+level\s+security/i, "enable rls"],
  [/\bcron\.schedule\b/i, "cron.schedule"],
];

/** Which durable objects a migration file appears to own. */
export const durableDdlIn = (sql) =>
  DURABLE_DDL.filter(([re]) => re.test(stripComments(sql))).map(([, n]) => n);

/**
 * Signals that a migration repairs THIS database rather than building any
 * database. Weighted, because no single one is conclusive.
 *
 * The strongest is barely a heuristic at all: a migration that asserts an
 * exact NONZERO number of rows WRITTEN cannot replay into an empty
 * database, because in an empty database it writes none. Two things are
 * deliberately not matched. Comparisons against zero are the opposite
 * claim — "nothing was missed" holds everywhere. And counts of catalog
 * objects a migration just created (its own triggers, policies, cron jobs)
 * are self-assertions about structure, which is exactly what SHOULD
 * rebuild, so the signal is anchored to `get diagnostics` on a write.
 *
 * These flag a migration for REVIEW. They never classify it.
 */
export const REPAIR_SIGNALS = [
  [
    /get\s+diagnostics[\s\S]{0,600}?(?:<>|!=)\s*(?!0\b)\d+/i,
    "asserts an exact nonzero number of rows written",
    2,
  ],
  [
    /\bvalues\s*\(\s*\d{1,6}\s*,\s*\d{1,6}\s*\)/i,
    "hardcoded business-record id pairs",
    2,
  ],
  [
    // Case-sensitive on purpose: the capitals ARE the signal. With /i this
    // matched values ('attachments', 'attachments', true) in the upstream
    // init migration and called a storage bucket a named client.
    /\b[Vv][Aa][Ll][Uu][Ee][Ss]\s*\(\s*'[A-Z][\w'’-]*'\s*,\s*'[A-Z][\w'’ -]*'\s*,/,
    "a table of named real clients",
    2,
  ],
  [
    /(?:update|delete\s+from)\s+(?:public\.)?\w+[\s\S]{0,400}?\bwhere\b[\s\S]{0,200}?\bid\s*=\s*\d{1,6}\b/i,
    "writes a hardcoded business-record id",
    1,
  ],
  [/\bset_historical_migration_mode\b/i, "runs in historical-import mode", 1],
];

/** Score and name the repair signals a migration's CODE carries. */
export const repairSignalsIn = (sql) => {
  const code = stripComments(sql);
  const hits = REPAIR_SIGNALS.filter(([re]) => re.test(code));
  return {
    names: hits.map(([, name]) => name),
    score: hits.reduce((total, [, , weight]) => total + weight, 0),
  };
};

/** At or above this, a migration must be classified or explicitly reviewed. */
export const REVIEW_THRESHOLD = 2;

/**
 * Deterministic migrations that legitimately match a signal, each with the
 * reason somebody looked and concluded it rebuilds rather than repairs.
 *
 * This is the pressure valve, so it is kept honest: an entry names a
 * migration that MUST replay into an empty database. Adding one to silence
 * a replay failure is the exact mistake this module exists to catch.
 */
export const REVIEWED_DETERMINISTIC = {
  // Matched "a table of named real clients" on
  //   values ('Zz', 'Exit Probe', now(), now())
  // which is a synthetic Contact, inserted inside a subtransaction that
  // the block then rolls back. The migration owns a function definition
  // and a grant and writes no business data at all; the row exists only
  // to prove, at deploy time, that ending a sale works for the role the
  // browser actually uses. It replays into an empty database, which is
  // where it was first proved.
  20260919180000:
    "synthetic probe row, rolled back; owns a function and a grant",
  // Matched the same way, on
  //   values ('Zz', 'Call Probe', now(), now())
  // — a synthetic Contact used to prove, at deploy time, that a sales
  // call can be created again by both the browser's role and the
  // webhook's. The probe deletes everything it made. The migration owns
  // a trigger function and its trigger and writes no business data.
  20260920020000:
    "synthetic probe row, deleted; owns a trigger function and its trigger",
  // Matched the same way, on
  //   values ('Zz', 'Clamp Probe', ...)
  // — two synthetic Contacts, one written as service_role and one as
  // authenticated, inside a subtransaction that ends by raising so both
  // roll back. They prove at deploy time that writing a Contact no longer
  // requires the right to read identity rows, and that the identity table
  // stays out of reach of the same role. The migration owns one function
  // definition and writes no business data.
  20260920130000:
    "synthetic probe rows, rolled back; owns a trigger function definition",
};

/**
 * Whether the canonical Acuity mapping is built from production data.
 *
 * It was, once: the map was seeded by SELECTing
 * offers.acuity_appointment_type_id, and nothing in the chain ever SET
 * those columns — so a rebuilt database had them null and a later
 * migration asserted configuration that only existed because production
 * data did. The map must state its types.
 */
export const acuityMapDependsOnProductionData = (sql) => {
  const code = stripComments(sql);
  const derivedSeed =
    /INSERT\s+INTO[^;]*acuity_appointment_type_map[^;]*SELECT[^;]*o\.acuity_appointment_type_id/is;
  const statesTypes = /'(?:91345095|64654501|90522599)'/;
  // A derived seed is only a problem when nothing states the types too.
  return derivedSeed.test(code) && !statesTypes.test(code);
};

/** Everything wrong with the current boundary, as a list of strings. */
export const auditReplayBoundary = () => {
  const manifest = readManifest();
  const files = listMigrationFiles();
  const problems = [];

  const seen = new Set();
  for (const entry of manifest.main_only_historical_data_repairs) {
    if (!files.includes(entry.file)) {
      problems.push(`manifest references a missing migration: ${entry.file}`);
    }
    if (seen.has(entry.version)) {
      problems.push(`migration registered twice: ${entry.version}`);
    }
    seen.add(entry.version);

    if (!entry.file.startsWith(entry.version)) {
      problems.push(
        `version and filename disagree: ${entry.version} / ${entry.file}`,
      );
    }
    if (entry.classification !== "main_only_historical_data_repair") {
      problems.push(
        `${entry.file}: unknown classification ${entry.classification}`,
      );
    }
    if (!entry.reason || entry.reason.length < 20) {
      problems.push(`${entry.file}: needs a reason somebody can review`);
    }

    if (!files.includes(entry.file)) continue;
    const sql = readFileSync(new URL(entry.file, MIGRATIONS_DIR), "utf8");
    const ddl = durableDdlIn(sql);
    if (ddl.length && entry.owns_durable_schema !== true) {
      problems.push(
        `${entry.file}: owns durable schema (${ddl.join(", ")}) but is not declared as doing so`,
      );
    }
    if (
      entry.owns_durable_schema === true &&
      entry.boundary_status !== "resolved"
    ) {
      problems.push(
        `${entry.file}: BOUNDARY VIOLATION — skipping it would leave the rebuilt database without ${(entry.durable_objects ?? ddl).join(", ")}`,
      );
    }
  }

  if (manifest.total_migration_versions !== files.length) {
    problems.push(
      `manifest says ${manifest.total_migration_versions} migration versions, the directory has ${files.length}`,
    );
  }

  // The question the original audit could not ask: is anything left
  // deterministic that should have been listed? Only a clean-room replay
  // proves it, but a replay costs a branch and an hour, so the cheap
  // version runs on every commit.
  for (const f of files) {
    const version = f.slice(0, f.indexOf("_"));
    if (seen.has(version)) continue;

    const sql = readFileSync(new URL(f, MIGRATIONS_DIR), "utf8");
    const { names, score } = repairSignalsIn(sql);
    if (score < REVIEW_THRESHOLD) continue;

    if (!REVIEWED_DETERMINISTIC[version]) {
      problems.push(
        `${f}: REVIEW REQUIRED — reads as a historical repair (${names.join("; ")}). Either list it in replay-manifest.json or record why it rebuilds from empty in REVIEWED_DETERMINISTIC.`,
      );
    }
  }

  // An allowlist entry for a migration that is no longer deterministic, or
  // no longer there, is stale and would hide the next violation.
  for (const version of Object.keys(REVIEWED_DETERMINISTIC)) {
    const file = files.find((f) => f.startsWith(version));
    if (!file) {
      problems.push(
        `REVIEWED_DETERMINISTIC names a missing migration: ${version}`,
      );
    } else if (seen.has(version)) {
      problems.push(
        `${version} is both reviewed-deterministic and listed as a MAIN-only repair`,
      );
    } else if (
      repairSignalsIn(readFileSync(new URL(file, MIGRATIONS_DIR), "utf8"))
        .score < REVIEW_THRESHOLD
    ) {
      problems.push(
        `${version} no longer trips any repair signal; remove its REVIEWED_DETERMINISTIC entry`,
      );
    }
  }

  // The Acuity map, for every migration that touches it.
  for (const f of files) {
    const sql = readFileSync(new URL(f, MIGRATIONS_DIR), "utf8");
    if (!/acuity_appointment_type_map/i.test(sql)) continue;
    if (acuityMapDependsOnProductionData(sql)) {
      problems.push(
        `${f}: the canonical Acuity mapping is derived from mutable production data again`,
      );
    }
  }

  return problems;
};

/** version -> "deterministic" | "main_only_historical_data_repair" */
export const classifyAll = () => {
  const manifest = readManifest();
  const skipped = new Set(
    manifest.main_only_historical_data_repairs.map((e) => e.version),
  );
  const out = new Map();
  for (const f of listMigrationFiles()) {
    const version = f.slice(0, f.indexOf("_"));
    out.set(
      version,
      skipped.has(version)
        ? "main_only_historical_data_repair"
        : "deterministic",
    );
  }
  return out;
};

if (process.argv[1]?.endsWith("replayBoundary.mjs")) {
  const problems = auditReplayBoundary();
  const classes = classifyAll();
  const deterministic = [...classes.values()].filter(
    (c) => c === "deterministic",
  ).length;
  const mainOnly = classes.size - deterministic;
  process.stdout.write(
    `${classes.size} migration versions: ${deterministic} deterministic + ${mainOnly} MAIN-only\n`,
  );
  for (const p of problems) process.stdout.write(`  PROBLEM: ${p}\n`);
  process.exit(problems.length ? 1 : 0);
}
