// Guards for the line between "rebuilds a database" and "repairs this one".
// Synthetic SQL only — no real applicant or client content.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  acuityMapDependsOnProductionData,
  auditReplayBoundary,
  classifyAll,
  durableDdlIn,
  listMigrationFiles,
  readManifest,
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
