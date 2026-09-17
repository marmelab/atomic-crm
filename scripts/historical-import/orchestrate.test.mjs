// Traces the orchestrator's actual call path with a mock `pg`-shaped
// client (records every query, returns synthetic-fixture-shaped rows) —
// proves each writer function is genuinely INVOKED for a representative
// person, not merely present unused in a file. No real client data.

import { test } from "node:test";
import assert from "node:assert/strict";
import { importPerson } from "./orchestrate.mjs";

function makeMockClient({ cohortIdByName = {} } = {}) {
  const queries = [];
  let nextId = 100;
  return {
    queries,
    async query(text, params) {
      queries.push({ text: text.trim().slice(0, 60), params });
      if (/select entity_id from historical_import_records/.test(text))
        return { rows: [] };
      if (
        /select id, first_name, last_name, stripe_customer_id, email_jsonb\s+from contacts/.test(
          text,
        )
      )
        return { rows: [] };
      if (/select id from waitlist_entries/.test(text)) return { rows: [] };
      if (/select id from enrollments where opportunity_id/.test(text))
        return { rows: [] };
      if (/select id from sales_calls where acuity_appointment_id/.test(text))
        return { rows: [] };
      if (
        /select id from client_sessions where acuity_appointment_id/.test(text)
      )
        return { rows: [] };
      if (/select id from cohorts where offer_id/.test(text)) {
        const id = cohortIdByName[params[1]];
        return id ? { rows: [{ id }] } : { rows: [] };
      }
      if (/^insert into historical_import_records/.test(text))
        return { rows: [] };
      if (/^insert into deal_stage_events/.test(text)) return { rows: [] };
      if (/^insert into enrollment_status_events/.test(text))
        return { rows: [] };
      // Every other INSERT ... RETURNING id gets a fresh synthetic id.
      return { rows: [{ id: nextId++ }] };
    },
  };
}

const rulings = () => ({
  canonicalStripeCustomerOverrides: {},
  pcEmails: [],
  ccRepresentable: {},
  ccContactOnly: [],
});

test("ordinary Pipeline person with a genuinely matched original application: Contact -> Deal -> Application -> no Waitlist/Enrollment/Acuity", async () => {
  const client = makeMockClient();
  const person = {
    canonicalEmail: "pipeline.person@example.com",
    altEmails: [],
    names: ["Pipeline Person"],
    operation: "CREATE",
    acuityEarliestCallDate: "2026-01-01",
    pipelineStages: ["Call Scheduled"],
    pipelinePrograms: ["The Living Example (1:1)"],
    hasApplication: true,
    matchedApplications: [
      {
        sourceUrl: "https://app.notion.com/synthetic-app-page-1",
        program: "LE",
        status: "Approved",
        submittedAt: "2026-01-01T00:00:00Z",
        rawFields: {
          "1. What’s the main pattern, emotion, or relationship dynamic you’re struggling with right now? ":
            "synthetic answer",
        },
      },
    ],
    waitlist: { LE: false, GYU: false },
    stripe: { customer: null },
    structuredAcuityAppointments: [],
  };
  const result = await importPerson(client, person, rulings(), {
    batchId: "test-batch",
  });
  assert.deepEqual(result.calledWriters, [
    "upsertHistoricalContact",
    "insertHistoricalDeal",
    "insertHistoricalApplication",
  ]);
});

test("Pipeline person with hasApplication:true but NO matched original application: Deal is still created, but no Application is fabricated", async () => {
  const client = makeMockClient();
  const person = {
    canonicalEmail: "unconfirmed.application@example.com",
    altEmails: [],
    names: ["Unconfirmed Application"],
    operation: "CREATE",
    acuityEarliestCallDate: "2026-01-01",
    pipelineStages: ["Call Scheduled"],
    pipelinePrograms: ["The Living Example (1:1)"],
    hasApplication: true, // the Pipeline's own (unreliable) boolean says yes
    matchedApplications: [], // but no original application record was ever found — see Phase 4G Part 5
    waitlist: { LE: false, GYU: false },
    stripe: { customer: null },
    structuredAcuityAppointments: [],
  };
  const result = await importPerson(client, person, rulings(), {
    batchId: "test-batch",
  });
  assert.deepEqual(result.calledWriters, [
    "upsertHistoricalContact",
    "insertHistoricalDeal",
  ]);
  assert.ok(
    !result.calledWriters.includes("insertHistoricalApplication"),
    "an unconfirmed Pipeline boolean must never fabricate an Application",
  );
});

test("a person with two genuinely distinct matched applications (e.g. LE and GYU) gets two separate Application rows, each with its own source key", async () => {
  const client = makeMockClient();
  const person = {
    canonicalEmail: "cross.program@example.com",
    altEmails: [],
    names: ["Cross Program"],
    operation: "CREATE",
    pipelineStages: ["Call Scheduled"],
    pipelinePrograms: ["The Living Example (1:1)"],
    hasApplication: true,
    matchedApplications: [
      {
        sourceUrl: "https://app.notion.com/synthetic-le-page",
        program: "LE",
        status: "Pending",
        submittedAt: "2026-01-01T00:00:00Z",
        rawFields: {},
      },
      {
        sourceUrl: "https://app.notion.com/synthetic-gyu-page",
        program: "GYU",
        status: "Approved",
        submittedAt: "2026-02-01T00:00:00Z",
        rawFields: {},
      },
    ],
    waitlist: { LE: false, GYU: false },
    stripe: { customer: null },
    structuredAcuityAppointments: [],
  };
  const client2Queries = [];
  const origQuery = client.query.bind(client);
  client.query = async (text, params) => {
    client2Queries.push({ text, params });
    return origQuery(text, params);
  };
  const result = await importPerson(client, person, rulings(), {
    batchId: "test-batch",
  });
  const appWriterCalls = result.calledWriters.filter(
    (w) => w === "insertHistoricalApplication",
  );
  assert.equal(
    appWriterCalls.length,
    2,
    "each matched application is its own insert call, never collapsed",
  );
  const insertCalls = client2Queries.filter((q) =>
    /^insert into applications/.test(q.text.trim()),
  );
  assert.equal(insertCalls.length, 2);
});

test("Phase 4I: a person with NO Deal at all still gets their real Application (Contact + Application only)", async () => {
  const client = makeMockClient();
  const person = {
    canonicalEmail: "no.deal.applicant@example.com",
    altEmails: [],
    names: ["No Deal Applicant"],
    operation: "CREATE",
    pipelineStages: [], // no Pipeline row at all — the 36-person GYU-outside-Pipeline case
    hasApplication: null,
    matchedApplications: [
      {
        sourceUrl: "https://app.notion.com/synthetic-no-deal-app",
        program: "GYU",
        status: "Approved",
        submittedAt: "2026-08-01T00:00:00Z",
        rawFields: {},
      },
    ],
    waitlist: { LE: false, GYU: false },
    stripe: { customer: null },
    structuredAcuityAppointments: [],
  };
  const result = await importPerson(client, person, rulings(), {
    batchId: "test-batch",
  });
  assert.deepEqual(result.calledWriters, [
    "upsertHistoricalContact",
    "insertHistoricalApplication",
  ]);
  const appInsert = client.queries.find((q) =>
    /^insert into applications/.test(q.text),
  );
  // $1 contact_id, $2 opportunity_id, ... $7 offer_id
  assert.ok(
    appInsert.params[0] != null,
    "contact_id must always be set — an Application belongs to a Contact",
  );
  assert.equal(
    appInsert.params[1],
    null,
    "opportunity_id (dealId) must be null, never a fabricated Deal",
  );
  assert.equal(
    appInsert.params[6],
    2,
    "offer_id must be stamped (GYU = 2) even with no Deal",
  );
  // (the mock truncates SQL text to 60 chars; the source stamping itself is
  // asserted against full SQL in write.test.mjs)
  assert.match(
    appInsert.text,
    /^insert into applications \(contact_id, opportunity_id/,
    "contact_id leads the Application insert",
  );
});

test("Phase 4I: intended_cohort_id resolves a real Cohort by name at import time, never a hardcoded id", async () => {
  const client = makeMockClient({
    cohortIdByName: { "Growing Yourself Up — January 2027": 42 },
  });
  const person = {
    canonicalEmail: "january.intent@example.com",
    altEmails: [],
    names: ["January Intent"],
    operation: "CREATE",
    pipelineStages: [],
    hasApplication: null,
    matchedApplications: [
      {
        sourceUrl: "https://app.notion.com/synthetic-january-intent",
        program: "GYU",
        status: "Approved",
        submittedAt: "2026-08-01T00:00:00Z",
        rawFields: {},
        intendedCohortName: "Growing Yourself Up — January 2027",
      },
    ],
    waitlist: { LE: false, GYU: false },
    stripe: { customer: null },
    structuredAcuityAppointments: [],
  };
  await importPerson(client, person, rulings(), { batchId: "test-batch" });
  const appInsert = client.queries.find((q) =>
    /^insert into applications/.test(q.text),
  );
  assert.equal(
    appInsert.params[7],
    42,
    "intended_cohort_id must be the resolved real Cohort id",
  );
});

test("Phase 4I: an intended cohort that doesn't exist yet fails closed rather than guessing an id", async () => {
  const client = makeMockClient(); // no cohorts configured
  const person = {
    canonicalEmail: "missing.cohort@example.com",
    altEmails: [],
    names: ["Missing Cohort"],
    operation: "CREATE",
    pipelineStages: [],
    hasApplication: null,
    matchedApplications: [
      {
        sourceUrl: "https://app.notion.com/synthetic-missing-cohort",
        program: "GYU",
        status: "Approved",
        submittedAt: "2026-08-01T00:00:00Z",
        rawFields: {},
        intendedCohortName: "Growing Yourself Up — January 2027",
      },
    ],
    waitlist: { LE: false, GYU: false },
    stripe: { customer: null },
    structuredAcuityAppointments: [],
  };
  await assert.rejects(() =>
    importPerson(client, person, rulings(), { batchId: "test-batch" }),
  );
});

test("an unrecognized historical Status is never guessed — importPerson throws rather than defaulting to pending", async () => {
  const client = makeMockClient();
  const person = {
    canonicalEmail: "bad.status@example.com",
    altEmails: [],
    names: ["Bad Status"],
    operation: "CREATE",
    pipelineStages: ["Call Scheduled"],
    pipelinePrograms: ["The Living Example (1:1)"],
    hasApplication: true,
    matchedApplications: [
      {
        sourceUrl: "https://app.notion.com/synthetic-bad-status",
        program: "LE",
        status: "Some New Status Nobody Has Seen",
        submittedAt: "2026-01-01T00:00:00Z",
        rawFields: {},
      },
    ],
    waitlist: { LE: false, GYU: false },
    stripe: { customer: null },
    structuredAcuityAppointments: [],
  };
  await assert.rejects(() =>
    importPerson(client, person, rulings(), { batchId: "test-batch" }),
  );
});

test("Active Client Pipeline person also reaches Enrollment + its status event", async () => {
  const client = makeMockClient();
  const person = {
    canonicalEmail: "active.client@example.com",
    altEmails: [],
    names: ["Active Client"],
    operation: "CREATE",
    pipelineStages: ["Active Client"],
    pipelinePrograms: ["The Living Example (1:1)"],
    hasApplication: false,
    waitlist: { LE: false, GYU: false },
    stripe: { customer: null },
    structuredAcuityAppointments: [],
    acuityEarliestCallDate: "2025-01-01", // a known date is required for an event to be planned at all — see plan.mjs
  };
  const result = await importPerson(client, person, rulings(), {
    batchId: "test-batch",
  });
  assert.ok(result.calledWriters.includes("insertHistoricalEnrollment"));
  assert.ok(
    result.calledWriters.includes("insertHistoricalEnrollmentStatusEvent"),
  );
  assert.ok(
    !result.calledWriters.includes("insertHistoricalApplication"),
    "hasApplication:false must not call the Application writer",
  );
});

test("Waitlist-only person: Contact -> Waitlist only, never a Deal", async () => {
  const client = makeMockClient();
  const person = {
    canonicalEmail: "waitlist.only@example.com",
    altEmails: [],
    names: ["Waitlist Only"],
    operation: "CREATE",
    pipelineStages: [],
    hasApplication: null,
    waitlist: { LE: false, GYU: true },
    waitlistJoinedAt: { GYU: "2026-07-20" },
    stripe: { customer: null },
    structuredAcuityAppointments: [],
  };
  const result = await importPerson(client, person, rulings(), {
    batchId: "test-batch",
  });
  assert.deepEqual(result.calledWriters, [
    "upsertHistoricalContact",
    "insertHistoricalWaitlistEntry:GYU",
  ]);
});

test("Waitlist entry without a resolved joined_at is refused, never written with a fabricated date", async () => {
  const client = makeMockClient();
  const person = {
    canonicalEmail: "waitlist.nodate@example.com",
    altEmails: [],
    names: ["Waitlist NoDate"],
    operation: "CREATE",
    pipelineStages: [],
    hasApplication: null,
    waitlist: { LE: true, GYU: false },
    // No waitlistJoinedAt at all: the caller never resolved a real source
    // timestamp. joined_at is NOT NULL and drives a live sorted UI field,
    // so this must fail closed rather than fall back to now().
    stripe: { customer: null },
    structuredAcuityAppointments: [],
  };
  await assert.rejects(
    () => importPerson(client, person, rulings(), { batchId: "test-batch" }),
    /joined_at is required and must be a REAL source timestamp/,
  );
  assert.equal(
    client.queries.filter((q) => /insert into waitlist_entries/i.test(q.text))
      .length,
    0,
    "must refuse before issuing any waitlist INSERT",
  );
});

test("Waitlist priority and notes reach the row, carrying the order-confidence caveat", async () => {
  const client = makeMockClient();
  const person = {
    canonicalEmail: "waitlist.confirmed@example.com",
    altEmails: [],
    names: ["Waitlist Confirmed"],
    operation: "CREATE",
    pipelineStages: [],
    hasApplication: null,
    waitlist: { LE: true, GYU: false },
    waitlistJoinedAt: { LE: "2026-08-20T17:49:18Z" },
    waitlistPriority: { LE: 7 },
    waitlistNotes: {
      LE: "order 7 is source-confirmed; joined_at is the source page creation time",
    },
    stripe: { customer: null },
    structuredAcuityAppointments: [],
  };
  await importPerson(client, person, rulings(), { batchId: "test-batch" });
  const insert = client.queries.find((q) =>
    /insert into waitlist_entries/i.test(q.text),
  );
  assert.ok(insert, "waitlist insert must be issued");
  assert.equal(
    insert.params[4],
    "2026-08-20T17:49:18Z",
    "joined_at is the real source timestamp",
  );
  assert.equal(
    insert.params[5],
    7,
    "priority carries the source-confirmed order",
  );
  assert.match(
    String(insert.params[6]),
    /source-confirmed/,
    "notes carries the confidence caveat",
  );
});

test("Contact-only legacy CC person: only the Contact writer is ever called", async () => {
  const client = makeMockClient();
  const person = {
    canonicalEmail: "legacy.cc@example.com",
    altEmails: [],
    names: ["Legacy CC"],
    operation: "CREATE",
    pipelineStages: [],
    hasApplication: null,
    waitlist: { LE: false, GYU: false },
    stripe: { customer: "cus_X" },
    structuredAcuityAppointments: [],
  };
  const r = rulings();
  r.ccContactOnly.push("legacy.cc@example.com");
  const result = await importPerson(client, person, r, {
    batchId: "test-batch",
  });
  assert.deepEqual(result.calledWriters, ["upsertHistoricalContact"]);
});

test("SKIP operation: zero writers called at all", async () => {
  const client = makeMockClient();
  const person = {
    canonicalEmail: "skipped@example.com",
    altEmails: [],
    names: ["Skipped"],
    operation: "SKIP",
    pipelineStages: [],
    waitlist: {},
    stripe: {},
    structuredAcuityAppointments: [],
  };
  const result = await importPerson(client, person, rulings(), {
    batchId: "test-batch",
  });
  assert.deepEqual(result.calledWriters, []);
  assert.equal(client.queries.length, 0, "SKIP must not issue a single query");
});

test("a structured sales-call-type appointment reaches insertHistoricalSalesCall, not insertHistoricalClientSession", async () => {
  const client = makeMockClient();
  const person = {
    canonicalEmail: "sales.call.person@example.com",
    altEmails: [],
    names: ["Sales Call Person"],
    operation: "CREATE",
    pipelineStages: ["Call Scheduled"],
    pipelinePrograms: ["The Living Example (1:1)"],
    hasApplication: false,
    waitlist: { LE: false, GYU: false },
    stripe: { customer: null },
    structuredAcuityAppointments: [
      {
        id: "appt-1",
        appointmentTypeID: 64654501,
        datetime: "2025-01-01T00:00:00Z",
      },
    ],
  };
  const result = await importPerson(client, person, rulings(), {
    batchId: "test-batch",
  });
  assert.ok(result.calledWriters.includes("insertHistoricalSalesCall"));
  assert.ok(!result.calledWriters.includes("insertHistoricalClientSession"));
});

test("a structured client-session-type appointment reaches insertHistoricalClientSession, not insertHistoricalSalesCall", async () => {
  const client = makeMockClient();
  const person = {
    canonicalEmail: "client.session.person@example.com",
    altEmails: [],
    names: ["Client Session Person"],
    operation: "CREATE",
    pipelineStages: ["Active Client"],
    pipelinePrograms: ["The Living Example (1:1)"],
    hasApplication: false,
    waitlist: { LE: false, GYU: false },
    stripe: { customer: null },
    structuredAcuityAppointments: [
      {
        id: "appt-2",
        appointmentTypeID: 90522599,
        datetime: "2025-01-01T00:00:00Z",
      },
    ],
  };
  const result = await importPerson(client, person, rulings(), {
    batchId: "test-batch",
  });
  assert.ok(result.calledWriters.includes("insertHistoricalClientSession"));
  assert.ok(!result.calledWriters.includes("insertHistoricalSalesCall"));
});
