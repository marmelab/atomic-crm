// Synthetic tests for write.mjs's pure helper. The DB-touching half
// (upsertHistoricalContact) requires a live `pg`-style client — this
// environment only has the `supabase db query --linked` CLI, not a direct
// Postgres connection string for a Node client, so that half is proven at
// the SQL level instead (see the Phase 4/4B checkpoint reports' rollback-
// transaction tests, which exercise the identical existing-lookup /
// conflict-detection / merge logic this function encodes). Documented here
// rather than silently skipped.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeEmailArrays, insertHistoricalDeal } from "./write.mjs";

test("mergeEmailArrays deduplicates by normalized email", () => {
  const existing = [{ email: "person@example.com", type: "other" }];
  const merged = mergeEmailArrays(existing, [
    "Person@Example.com",
    "second@example.com",
  ]);
  assert.equal(merged.length, 2);
  assert.ok(merged.some((e) => e.email === "person@example.com"));
  assert.ok(merged.some((e) => e.email === "second@example.com"));
});

test("mergeEmailArrays preserves the existing entry's original casing/type over a re-added duplicate", () => {
  const existing = [{ email: "person@example.com", type: "work" }];
  const merged = mergeEmailArrays(existing, ["person@example.com"]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].type, "work");
});

test("mergeEmailArrays handles an empty existing array", () => {
  const merged = mergeEmailArrays([], ["a@example.com", "b@example.com"]);
  assert.equal(merged.length, 2);
});

test("mergeEmailArrays ignores malformed existing entries without an email", () => {
  const existing = [{ type: "other" }, null];
  const merged = mergeEmailArrays(existing, ["a@example.com"]);
  assert.equal(merged.length, 1);
});

// ---------------------------------------------------------------------------
// insertHistoricalDeal's Offer fail-fast guard (Phase 4M) — this is a pure
// pre-flight check (throws before ANY client.query call), so it's testable
// without a live database: a client whose .query would throw if ever
// called proves the guard genuinely short-circuits before touching SQL.
// ---------------------------------------------------------------------------

test("insertHistoricalDeal refuses a null offerId before issuing any SQL", async () => {
  const client = {
    query: async () => {
      throw new Error(
        "must never be called — the guard should short-circuit first",
      );
    },
  };
  await assert.rejects(
    () =>
      insertHistoricalDeal(client, {
        sourceKey: "k",
        sourceSystem: "notion_pipeline",
        batchId: "b",
        contactId: 1,
        offerId: null,
        stage: "committed",
        name: "Synthetic",
      }),
    /invalid offerId/,
  );
});

test("insertHistoricalDeal refuses an offerId outside {1,2} before issuing any SQL", async () => {
  const client = {
    query: async () => {
      throw new Error("must never be called");
    },
  };
  await assert.rejects(
    () =>
      insertHistoricalDeal(client, {
        sourceKey: "k",
        sourceSystem: "notion_pipeline",
        batchId: "b",
        contactId: 1,
        offerId: 999,
        stage: "committed",
        name: "Synthetic",
      }),
    /invalid offerId/,
  );
});

test("insertHistoricalDeal refuses a null/invalid stage before issuing any SQL (Phase 4N)", async () => {
  const client = {
    query: async () => {
      throw new Error("must never be called");
    },
  };
  await assert.rejects(
    () =>
      insertHistoricalDeal(client, {
        sourceKey: "k",
        sourceSystem: "notion_pipeline",
        batchId: "b",
        contactId: 1,
        offerId: 1,
        stage: null,
        name: "Synthetic",
        createdAt: "2025-01-01",
        updatedAt: "2025-01-01",
        stageEnteredAt: "2025-01-01",
      }),
    /invalid stage/,
  );
  await assert.rejects(
    () =>
      insertHistoricalDeal(client, {
        sourceKey: "k2",
        sourceSystem: "notion_pipeline",
        batchId: "b",
        contactId: 1,
        offerId: 1,
        stage: "final-frozen-stage",
        name: "Synthetic",
        createdAt: "2025-01-01",
        updatedAt: "2025-01-01",
        stageEnteredAt: "2025-01-01",
      }),
    /invalid stage/,
  );
});

test("insertHistoricalDeal refuses a missing createdAt/updatedAt/stageEnteredAt before issuing any SQL (Phase 4O) — never a single value standing in for all three", async () => {
  const client = {
    query: async () => {
      throw new Error("must never be called");
    },
  };
  const base = {
    sourceKey: "k",
    sourceSystem: "notion_pipeline",
    batchId: "b",
    contactId: 1,
    offerId: 1,
    stage: "committed",
    name: "Synthetic",
  };
  await assert.rejects(
    () =>
      insertHistoricalDeal(client, {
        ...base,
        updatedAt: "2025-01-01",
        stageEnteredAt: "2025-01-01",
      }),
    /createdAt/,
  );
  await assert.rejects(
    () =>
      insertHistoricalDeal(client, {
        ...base,
        createdAt: "2025-01-01",
        stageEnteredAt: "2025-01-01",
      }),
    /updatedAt/,
  );
  await assert.rejects(
    () =>
      insertHistoricalDeal(client, {
        ...base,
        createdAt: "2025-01-01",
        updatedAt: "2025-01-01",
      }),
    /stageEnteredAt/,
  );
});

// ---------------------------------------------------------------------------
// Contact identity probe. contacts has NO unique email index, so a
// canonical-only lookup silently duplicates anyone who signed up to the
// live CRM under a different address than the historical sources treat as
// canonical (this really happened in the Gate A full-volume run).
// ---------------------------------------------------------------------------

function contactProbeClient(matchRows) {
  const queries = [];
  return {
    queries,
    async query(text, params = []) {
      queries.push({ text: text.trim(), params });
      if (/from historical_import_records/.test(text)) return { rows: [] };
      if (
        /from contacts/.test(text) &&
        /^select id, first_name/.test(text.trim())
      )
        return { rows: matchRows };
      if (/returning id$/i.test(text.trim())) return { rows: [{ id: 999 }] };
      return { rows: [] };
    },
  };
}

test("upsertHistoricalContact probes every known email, not just the canonical one", async () => {
  const { upsertHistoricalContact } = await import("./write.mjs");
  const client = contactProbeClient([]);
  await upsertHistoricalContact(client, {
    sourceKey: "k",
    sourceSystem: "s",
    batchId: "b",
    canonicalEmail: "canonical@example.com",
    altEmails: ["Alternate@Example.com"],
    firstName: "A",
    lastName: "B",
    stripeCustomerId: null,
  });
  const probe = client.queries.find((q) =>
    /^select id, first_name/.test(q.text),
  );
  const probed = JSON.parse(probe.params[0]);
  assert.deepEqual(probed, ["canonical@example.com", "alternate@example.com"]);
});

test("upsertHistoricalContact refuses when a person's emails reach two different existing contacts", async () => {
  const { upsertHistoricalContact } = await import("./write.mjs");
  const client = contactProbeClient([
    {
      id: 26,
      first_name: "Wren",
      last_name: "B",
      stripe_customer_id: null,
      email_jsonb: [{ email: "one@example.com" }],
    },
    {
      id: 41,
      first_name: "Wren",
      last_name: "B",
      stripe_customer_id: null,
      email_jsonb: [{ email: "two@example.com" }],
    },
  ]);
  await assert.rejects(
    () =>
      upsertHistoricalContact(client, {
        sourceKey: "k",
        sourceSystem: "s",
        batchId: "b",
        canonicalEmail: "one@example.com",
        altEmails: ["two@example.com"],
        firstName: "Wren",
        lastName: "B",
        stripeCustomerId: null,
      }),
    /Ambiguous identity.*2 different existing contacts \(ids 26, 41\)/,
  );
  assert.equal(
    client.queries.filter((q) => /^insert into contacts/.test(q.text)).length,
    0,
  );
});

test("upsertHistoricalContact updates the single contact reached by an ALT email rather than creating a duplicate", async () => {
  const { upsertHistoricalContact } = await import("./write.mjs");
  const client = contactProbeClient([
    {
      id: 26,
      first_name: "Wren",
      last_name: "Halloway",
      stripe_customer_id: null,
      email_jsonb: [{ email: "live@example.com", type: "Other" }],
    },
  ]);
  const r = await upsertHistoricalContact(client, {
    sourceKey: "k",
    sourceSystem: "s",
    batchId: "b",
    canonicalEmail: "historical@example.com",
    altEmails: ["live@example.com"],
    firstName: "Wren",
    lastName: "Halloway",
    stripeCustomerId: null,
  });
  assert.equal(r.operation, "update");
  assert.equal(r.contactId, 26);
  assert.equal(
    client.queries.filter((q) => /^insert into contacts/.test(q.text)).length,
    0,
  );
});

// ---------------------------------------------------------------------------
// Application <-> Contact relationship and record origin.
// ---------------------------------------------------------------------------

test("insertHistoricalApplication refuses to write without a contact_id", async () => {
  const { insertHistoricalApplication } = await import("./write.mjs");
  const client = contactProbeClient([]);
  await assert.rejects(
    () =>
      insertHistoricalApplication(client, {
        sourceKey: "https://app.notion.com/x",
        sourceSystem: "notion_application",
        batchId: "b",
        contactId: null,
        dealId: 5,
        status: "pending",
        submittedAt: "2026-01-01T00:00:00Z",
        rawAnswers: {},
        offerId: 1,
        intendedCohortId: null,
      }),
    /contact_id is required/,
  );
  assert.equal(
    client.queries.filter((q) => /^insert into applications/.test(q.text))
      .length,
    0,
  );
});

test("historical Application WITHOUT a Deal writes contact_id and a null opportunity_id — never a fabricated Deal", async () => {
  const { insertHistoricalApplication } = await import("./write.mjs");
  const client = contactProbeClient([]);
  await insertHistoricalApplication(client, {
    sourceKey: "https://app.notion.com/no-deal",
    sourceSystem: "notion_application",
    batchId: "b",
    contactId: 42,
    dealId: null,
    status: "pending",
    submittedAt: "2026-01-01T00:00:00Z",
    rawAnswers: {},
    offerId: 2,
    intendedCohortId: null,
  });
  const insert = client.queries.find((q) =>
    /^insert into applications/.test(q.text),
  );
  assert.equal(
    insert.params[0],
    42,
    "contact_id is the canonical person relationship",
  );
  assert.equal(
    insert.params[1],
    null,
    "opportunity_id stays null — no Deal is invented",
  );
  assert.equal(
    client.queries.filter((q) => /^insert into deals/.test(q.text)).length,
    0,
  );
});

test("historical Application WITH a Deal keeps both relationships", async () => {
  const { insertHistoricalApplication } = await import("./write.mjs");
  const client = contactProbeClient([]);
  await insertHistoricalApplication(client, {
    sourceKey: "https://app.notion.com/with-deal",
    sourceSystem: "notion_application",
    batchId: "b",
    contactId: 42,
    dealId: 7,
    status: "approved",
    submittedAt: "2026-01-01T00:00:00Z",
    rawAnswers: {},
    offerId: 1,
    intendedCohortId: null,
  });
  const insert = client.queries.find((q) =>
    /^insert into applications/.test(q.text),
  );
  assert.equal(insert.params[0], 42);
  assert.equal(insert.params[1], 7);
});

test("historical Applications are stamped as imported records, never as live submissions", async () => {
  const { insertHistoricalApplication } = await import("./write.mjs");
  const client = contactProbeClient([]);
  await insertHistoricalApplication(client, {
    sourceKey: "https://app.notion.com/origin",
    sourceSystem: "notion_application",
    batchId: "b",
    contactId: 42,
    dealId: null,
    status: "pending",
    submittedAt: "2026-01-01T00:00:00Z",
    rawAnswers: {},
    offerId: 2,
    intendedCohortId: null,
  });
  const insert = client.queries.find((q) =>
    /^insert into applications/.test(q.text),
  );
  assert.match(insert.text, /source\)/, "source column is written");
  assert.match(
    insert.text,
    /'historical_import'/,
    "stamped historical_import, so a 'pending' historical status never becomes live review work",
  );
  assert.doesNotMatch(insert.text, /'public_form'/);
});
