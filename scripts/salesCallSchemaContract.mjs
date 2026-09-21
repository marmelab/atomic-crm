#!/usr/bin/env node
// Regenerates contracts/sales-calls/creationSchemaContract.json from a live
// database.
//
//   node scripts/salesCallSchemaContract.mjs            # print the live contract
//   node scripts/salesCallSchemaContract.mjs --write     # rewrite the snapshot
//   node scripts/salesCallSchemaContract.mjs --e2e       # read the e2e instance
//
// Default source is the linked project. Pass --e2e to read the throwaway
// instance `make start-supabase-e2e` builds from the migration chain.
//
// Everything it runs is read-only: information_schema and the catalogs.
//
// Why the snapshot exists at all: sales_calls has a NOT NULL column with no
// default that no writer supplies, kept alive solely by a BEFORE trigger.
// That arrangement works and is deliberate, but it is one migration away
// from taking every Sales Call INSERT down, which is exactly what happened
// on 2026-09-17. Pinning it means a change to it has to be looked at.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const SNAPSHOT = path.join(
  REPO_ROOT,
  "contracts/sales-calls/creationSchemaContract.json",
);

const SQL = `
select jsonb_build_object(
  'columns', (
    select jsonb_object_agg(column_name, jsonb_build_object(
             'is_nullable',   is_nullable,
             'is_identity',   is_identity,
             'column_default', coalesce(column_default, '')))
      from information_schema.columns
     where table_schema = 'public' and table_name = 'sales_calls'),
  'check_constraints', (
    select jsonb_object_agg(conname, pg_get_constraintdef(oid))
      from pg_constraint
     where conrelid = 'public.sales_calls'::regclass and contype = 'c'),
  'triggers', (
    select jsonb_object_agg(tgname, pg_get_triggerdef(oid))
      from pg_trigger
     where tgrelid = 'public.sales_calls'::regclass and not tgisinternal)
) as contract;`;

// Pull the JSON out of a command's stdout, and say something useful when
// there isn't any.
//
// The first version did `JSON.parse(raw.slice(raw.indexOf("{")))`. When
// stdout carries no JSON at all, indexOf returns -1, slice(-1) hands back
// the trailing newline, and JSON.parse reports "Unexpected end of JSON
// input" — which names neither the command that produced nothing nor what
// it actually said. That is exactly how this failed in CI and nowhere
// else, and the message was useless for a week's worth of guessing.
const parseJsonFrom = (raw, what) => {
  const start = raw.indexOf("{");
  if (start !== -1) {
    try {
      return JSON.parse(raw.slice(start));
    } catch {
      /* fall through to the explicit failure below */
    }
  }
  throw new Error(
    `${what} produced no JSON on stdout. It printed:\n${raw.trim() || "(nothing)"}`,
  );
};

// The clean room is read through psql in its own container, not through
// `supabase db query`.
//
// The CLI is pinned nowhere — it is not a dependency, so `npx supabase`
// resolves whatever is newest at the moment it runs, and CI and a laptop
// need not agree. Its stdout format is not a contract, and this script was
// parsing it as though it were: on the GitHub runner the command exited 0
// having printed only "Connecting to local database...", and the schema
// contract test failed there while passing everywhere else.
//
// docker exec + psql is the same mechanism cleanRoomBootstrap.mjs already
// uses to build the clean room, so it is proven in both environments by
// the time this runs, and `psql -t -A` emits the jsonb value and nothing
// else. The linked path still uses the CLI: it is for a human reading
// production by hand, never for CI.
const readLive = (useE2e) => {
  if (useE2e) {
    const raw = execFileSync(
      "docker",
      [
        "exec",
        "-i",
        "supabase_db_atomic-crm-e2e",
        "psql",
        "-v",
        "ON_ERROR_STOP=1",
        "-t",
        "-A",
        "-U",
        "postgres",
        "-d",
        "postgres",
      ],
      { input: SQL, encoding: "utf8", cwd: REPO_ROOT },
    );
    return parseJsonFrom(raw, "psql in the clean-room container");
  }

  const raw = execFileSync("npx", ["supabase", "db", "query", "--linked"], {
    input: SQL,
    encoding: "utf8",
    cwd: REPO_ROOT,
  });
  return parseJsonFrom(raw, "supabase db query --linked").rows[0].contract;
};

// Four ways a column gets a value on INSERT, and they are not
// interchangeable. Collapsing them is what made the first version of this
// snapshot list `id` and `contact_id` beside `scheduled_on` as though the
// three were the same kind of thing.
const fillMechanism = (column, info, triggerFilled) => {
  if (info.is_identity === "YES") return "identity";
  if (info.column_default !== "") return "default";
  if (triggerFilled.includes(column)) return "trigger";
  return "writer";
};

const build = (live) => {
  // Which columns a BEFORE INSERT trigger assigns. Read from the trigger
  // definitions rather than assumed, so a renamed trigger shows up here.
  const triggerFilled = Object.entries(live.triggers)
    .filter(([, def]) => /BEFORE INSERT/i.test(def))
    .flatMap(([, def]) =>
      /derive_sales_call_scheduled_on/i.test(def) ? ["scheduled_on"] : [],
    )
    .sort();

  const notNull = Object.entries(live.columns)
    .filter(([, info]) => info.is_nullable === "NO")
    .map(([name]) => name)
    .sort();

  const mechanism = Object.fromEntries(
    notNull.map((name) => [
      name,
      fillMechanism(name, live.columns[name], triggerFilled),
    ]),
  );

  const sorted = (obj) =>
    Object.fromEntries(
      Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)),
    );

  return {
    $comment:
      "The creation contract of public.sales_calls, pinned. A migration that changes any of it fails e2e/salesCallWriteContracts.spec.ts, which in the same run replays EVERY inventoried writer's real payload against a real database — so nullability, required fields, CHECK constraints and creation-time triggers cannot move without all of them being exercised. Regenerate deliberately with `node scripts/salesCallSchemaContract.mjs --write` and read the diff before committing it.",
    version: 2,
    table: "public.sales_calls",
    captured_from:
      "the migrated schema (migration chain through 20260920100000)",
    creation_fill_mechanism_note:
      "For every NOT NULL column, WHAT puts a value there on INSERT. `identity` is PostgreSQL generating it (GENERATED BY DEFAULT AS IDENTITY — NOT a DEFAULT expression, and it does not appear in column_default). `default` is a literal DEFAULT expression. `trigger` is a BEFORE INSERT trigger. `writer` means the caller must supply it, and contracts/sales-calls/writers.json says which callers those are. Keeping these four apart is the point: only `writer` columns are the writers' obligation, and only `trigger` columns depend on something that a migration can silently remove.",
    creation_fill_mechanism: mechanism,
    writer_supplied_columns: notNull.filter((c) => mechanism[c] === "writer"),
    trigger_filled_columns: notNull.filter((c) => mechanism[c] === "trigger"),
    identity_columns: notNull.filter((c) => mechanism[c] === "identity"),
    defaulted_columns: notNull.filter((c) => mechanism[c] === "default"),
    all_columns: Object.keys(live.columns).sort(),
    not_null_columns: notNull,
    column_defaults: sorted(
      Object.fromEntries(
        Object.entries(live.columns)
          .filter(([, info]) => info.column_default !== "")
          .map(([name, info]) => [name, info.column_default]),
      ),
    ),
    check_constraints: sorted(live.check_constraints),
    triggers: sorted(live.triggers),
    load_bearing_note:
      "scheduled_on is the only NOT NULL column with no default, no identity and no writer supplying it. derive_sales_call_scheduled_on_trigger is the single thing that populates it. Remove or narrow that trigger and every Sales Call INSERT fails, exactly as it did for three days in September 2026.",
  };
};

// Exported so the parse guard can be tested without a database. Running
// the script is gated on being the entry point, so importing it does not
// go looking for one.
export { parseJsonFrom };

const isEntryPoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (!isEntryPoint) {
  // Imported for its helpers; nothing else to do.
} else {
  const useE2e = process.argv.includes("--e2e");
  const contract = build(readLive(useE2e));
  const serialized = JSON.stringify(contract, null, 2) + "\n";

  if (process.argv.includes("--write")) {
    writeFileSync(SNAPSHOT, serialized);
    process.stdout.write(`wrote ${path.relative(REPO_ROOT, SNAPSHOT)}\n`);
  } else {
    process.stdout.write(serialized);

    // Compared as VALUES, not as bytes. Prettier collapses short arrays onto
    // one line and JSON.stringify does not, so a byte comparison would
    // report drift every time the repo formatter had touched the snapshot —
    // a check that cries wolf is a check people learn to ignore.
    const committed = (() => {
      try {
        return JSON.parse(readFileSync(SNAPSHOT, "utf8"));
      } catch {
        return null;
      }
    })();

    if (committed !== null) {
      const stable = (value) => JSON.stringify(value);
      if (stable(committed) !== stable(contract)) {
        console.error(
          "\nThe live schema differs from contracts/sales-calls/creationSchemaContract.json. Re-run with --write, read the diff, and re-run the Sales Call writer contracts before committing it.",
        );
        process.exitCode = 1;
      }
    }
  }
}
