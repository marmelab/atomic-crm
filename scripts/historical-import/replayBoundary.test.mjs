// Guards for the line between "rebuilds a database" and "repairs this one".
// Synthetic SQL only — no real applicant or client content.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  acuityMapDependsOnProductionData,
  auditReplayBoundary,
  classifyAll,
  durableDdlIn,
  listMigrationFiles,
  MIGRATIONS_DIR,
  readManifest,
  repairSignalsIn,
  REVIEW_THRESHOLD,
  REVIEWED_DETERMINISTIC,
  stripComments,
} from "./replayBoundary.mjs";

test("every migration version is accounted for, exactly once", () => {
  // Arrange
  const files = listMigrationFiles();
  const classes = classifyAll();

  // Assert — the sum has to be the whole chain, or "accounted for" is a
  // claim about a subset.
  assert.equal(classes.size, files.length);
  const deterministic = [...classes.values()].filter(
    (c) => c === "deterministic",
  ).length;
  const mainOnly = [...classes.values()].filter(
    (c) => c === "main_only_historical_data_repair",
  ).length;
  assert.equal(deterministic + mainOnly, files.length);
});

test("the manifest only names migrations that exist", () => {
  // Arrange
  const files = new Set(listMigrationFiles());

  // Assert
  for (const entry of readManifest().main_only_historical_data_repairs) {
    assert.ok(files.has(entry.file), `missing migration: ${entry.file}`);
  }
});

test("no migration is registered twice", () => {
  // Arrange
  const versions = readManifest().main_only_historical_data_repairs.map(
    (e) => e.version,
  );

  // Assert
  assert.equal(new Set(versions).size, versions.length);
});

test("every MAIN-only entry carries a reason a person can review", () => {
  // Assert — classification by filename heuristic is exactly what this
  // manifest exists to replace.
  for (const entry of readManifest().main_only_historical_data_repairs) {
    assert.equal(entry.classification, "main_only_historical_data_repair");
    assert.ok(entry.reason.length >= 20, `${entry.file}: reason too thin`);
  }
});

test("a migration owning durable schema is declared as owning it", () => {
  // Assert — the audit reports an undeclared owner as a problem, which is
  // the failure mode that silently loses a column in a rebuild.
  const problems = auditReplayBoundary();
  const undeclared = problems.filter((p) => p.includes("but is not declared"));
  assert.deepEqual(undeclared, []);
});

test("durable DDL is recognised, and prose about it is not", () => {
  // Arrange — the same words, once as SQL and once as a comment.
  const real = `alter table public.deals add column if not exists foo text;`;
  const prose = `-- alter table public.deals add column if not exists foo text;\nupdate deals set x = 1;`;

  // Act / Assert
  assert.deepEqual(durableDdlIn(real), ["add column"]);
  assert.deepEqual(durableDdlIn(prose), []);
  assert.ok(!stripComments(prose).includes("add column"));
});

test("a data repair that quietly adds a trigger is caught", () => {
  // Arrange — the shape that breaks a rebuild: repair plus structure.
  const mixed = `
    update deals set outcome = null where id = 187;
    create trigger guard_something before insert on public.deals
      for each row execute function public.guard_something();`;

  // Act / Assert
  assert.ok(durableDdlIn(mixed).includes("create trigger"));
});

test("a temporary helper inside a repair is not treated as durable", () => {
  // Arrange — created and dropped within the repair, so it owns nothing.
  const temp = `
    create temporary table t_scratch (id bigint);
    insert into t_scratch select id from deals;
    drop table t_scratch;`;

  // Assert
  assert.deepEqual(durableDdlIn(temp), []);
});

test("the Acuity map may not go back to deriving itself from Offers", () => {
  // Arrange — the original defect: seed the map by SELECTing whichever
  // Offer happens to carry an appointment-type id. Nothing in the chain
  // ever sets those columns, so a rebuilt database had them null.
  const derived = `
    INSERT INTO acuity_appointment_type_map (acuity_appointment_type_id, offer_id, kind)
    SELECT o.acuity_appointment_type_id, o.id, 'sales_call' FROM offers o
     WHERE o.acuity_appointment_type_id IS NOT NULL;`;

  // Act / Assert
  assert.equal(acuityMapDependsOnProductionData(derived), true);
});

test("a derived pass is allowed once the canonical types are stated", () => {
  // Arrange — stating the configuration first is what makes the map
  // reconstructible; a gap-filling pass afterwards is harmless.
  const stated = `
    INSERT INTO acuity_appointment_type_map VALUES ('91345095', v_le, 'sales_call');
    INSERT INTO acuity_appointment_type_map (acuity_appointment_type_id, offer_id, kind)
    SELECT o.acuity_appointment_type_id, o.id, 'sales_call' FROM offers o
     WHERE o.acuity_appointment_type_id IS NOT NULL;`;

  // Act / Assert
  assert.equal(acuityMapDependsOnProductionData(stated), false);
});

test("the real migration chain no longer derives the Acuity map", () => {
  // Assert — against the actual files, not a fixture.
  const problems = auditReplayBoundary().filter((p) =>
    p.includes("derived from mutable production data"),
  );
  assert.deepEqual(problems, []);
});

test("a new migration is deterministic unless somebody lists it", () => {
  // Arrange — the default has to be the safe one.
  const classes = classifyAll();
  const listed = new Set(
    readManifest().main_only_historical_data_repairs.map((e) => e.version),
  );

  // Assert
  for (const [version, klass] of classes) {
    if (!listed.has(version)) assert.equal(klass, "deterministic");
  }
});

// ---------------------------------------------------------------------
// The blind spot: a repair left classified as deterministic
// ---------------------------------------------------------------------
// The audit above proves everything DECLARED MAIN-only is safe to skip.
// It could not ask the opposite question, so three named-client repairs
// sat in the deterministic set until a clean-room replay refused them.
// These guard the question it can now ask.

test("an exact nonzero count of rows written reads as a repair", () => {
  // Arrange — true only of a database that already holds those rows.
  const sql = `
    update public.deals set outcome = null where stage = 'call_booked';
    get diagnostics v_updated = row_count;
    if v_updated <> 2 then raise exception 'expected two'; end if;`;

  // Act / Assert
  const { score, names } = repairSignalsIn(sql);
  assert.ok(score >= REVIEW_THRESHOLD);
  assert.ok(names.some((n) => n.includes("rows written")));
});

test("asserting that nothing was missed is not a repair signal", () => {
  // Arrange — "zero rows were left behind" holds in an empty database
  // too, so it is exactly the shape a deterministic backfill should use.
  const sql = `
    insert into public.b select * from public.a;
    get diagnostics v_copied = row_count;
    if (select count(*) from public.a where not exists (
         select 1 from public.b where b.id = a.id)) <> 0 then
      raise exception 'backfill incomplete';
    end if;`;

  // Act / Assert
  assert.ok(repairSignalsIn(sql).score < REVIEW_THRESHOLD);
});

test("counting the structure a migration just created is not a repair", () => {
  // Arrange — a migration proving its OWN triggers landed is asserting
  // the thing that should rebuild, not the thing that should not.
  const sql = `
    create trigger t1 before insert on public.x for each row execute function f();
    do $$ begin
      if (select count(*) from pg_trigger where tgrelid = 'public.x'::regclass
           and not tgisinternal) <> 2 then
        raise exception 'triggers missing';
      end if;
      if (select count(*) from cron.job where jobname = 'reconcile') <> 1 then
        raise exception 'cron missing';
      end if;
    end $$;`;

  // Act / Assert
  assert.ok(repairSignalsIn(sql).score < REVIEW_THRESHOLD);
});

test("a lowercase seed row is not mistaken for a table of real people", () => {
  // Arrange — the capitals are the signal. Case-insensitively, this
  // storage-bucket seed in the upstream init migration matched.
  const sql = `insert into storage.buckets (id, name, public)
               values ('attachments', 'attachments', true);`;

  // Act / Assert
  assert.ok(repairSignalsIn(sql).score < REVIEW_THRESHOLD);
});

test("the three migrations the replay caught would now be flagged", () => {
  // Arrange — A, B and C, read from the real chain rather than fixtures.
  const caught = {
    "20260918140000_merge_group_a_identities.sql": "A",
    "20260918280000_commercial_totals_derived_from_stripe.sql": "B",
    "20260918290000_close_the_reviews_stripe_now_answers.sql": "C",
  };

  // Act / Assert — each must trip the guard on its own content, which is
  // what would have caught it before a branch and an hour were spent.
  for (const file of Object.keys(caught)) {
    const sql = readFileSync(new URL(file, MIGRATIONS_DIR), "utf8");
    const { score, names } = repairSignalsIn(sql);
    assert.ok(
      score >= REVIEW_THRESHOLD,
      `${file} scored ${score} (${names.join("; ")}), below the review threshold`,
    );
  }
});

test("B is now a pure repair: its structure moved out", () => {
  // Arrange
  const b = readFileSync(
    new URL(
      "20260918280000_commercial_totals_derived_from_stripe.sql",
      MIGRATIONS_DIR,
    ),
    "utf8",
  );
  const extracted = readFileSync(
    new URL(
      "20260918275000_commercial_total_source_structure.sql",
      MIGRATIONS_DIR,
    ),
    "utf8",
  );

  // Assert — the repair owns no durable structure...
  assert.deepEqual(durableDdlIn(b), []);
  // ...and the structure it used to own is created somewhere that replays.
  assert.match(
    extracted,
    /add column if not exists selected_payment_total_source/i,
  );
  assert.match(extracted, /deals_selected_payment_total_source_check/i);
});

test("extracted structure precedes every migration that uses it", () => {
  // Arrange — ordering is the whole reason the version is 20260918275000
  // and not a later one.
  const owner = "20260918275000";
  const users = listMigrationFiles().filter((f) => {
    if (f.startsWith(owner)) return false;
    const sql = readFileSync(new URL(f, MIGRATIONS_DIR), "utf8");
    return /selected_payment_total_source/i.test(stripComments(sql));
  });

  // Assert
  assert.ok(
    users.length > 0,
    "nothing uses the column; the extraction is dead code",
  );
  for (const f of users) {
    assert.ok(
      f.slice(0, owner.length) > owner,
      `${f} uses the column but sorts before the migration that creates it`,
    );
  }
});

test("no MAIN-only repair owns unresolved durable structure", () => {
  // Assert — the closing condition for the whole boundary.
  for (const entry of readManifest().main_only_historical_data_repairs) {
    const sql = readFileSync(new URL(entry.file, MIGRATIONS_DIR), "utf8");
    assert.deepEqual(
      durableDdlIn(sql),
      [],
      `${entry.file} still owns durable structure`,
    );
    assert.equal(entry.owns_durable_schema, false);
  }
});

test("the allowlist cannot quietly become the way out", () => {
  // Assert — every entry must name a real, still-signalling migration.
  // An empty allowlist is the healthy state and is allowed.
  const files = listMigrationFiles();
  for (const [version, reason] of Object.entries(REVIEWED_DETERMINISTIC)) {
    assert.ok(
      files.some((f) => f.startsWith(version)),
      `${version} does not exist`,
    );
    assert.ok(reason.length > 30, `${version} needs a reviewable reason`);
  }
});
