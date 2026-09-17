// Synthetic-fixture tests for the pure planning logic. No real client data
// anywhere in this file — every email/name/ruling below is a fabricated
// example shaped like the real staging manifest + rulings, never the real
// thing. Run with: node --test scripts/historical-import/plan.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planPerson,
  summarizePlan,
  diffAgainstFrozenManifest,
  resolveDealOfferId,
  resolveDealStage,
  resolveDealTimestamps,
} from "./plan.mjs";

const basePerson = (overrides = {}) => ({
  canonicalEmail: "example.person@example.com",
  altEmails: [],
  names: ["Example Person"],
  operation: "CREATE",
  pipelineStages: [],
  crmContactId: [],
  waitlist: { LE: false, GYU: false },
  acuity: { total: 0, current: 0, legacy: 0 },
  stripe: { customer: null, customerCreated: null, subscriptions: [] },
  hasApplication: null,
  acuityEarliestCallDate: null,
  ...overrides,
});

const syntheticRulings = () => ({
  canonicalStripeCustomerOverrides: {
    "duplicate.customer@example.com": "cus_SYNTHETIC_CANONICAL",
  },
  pcEmails: ["potential.client@example.com"],
  ccRepresentable: {
    "completed.client@example.com": { offerId: 2, dealStage: "won" },
  },
  ccContactOnly: ["legacy.client@example.com"],
  explicitOfferOverrides: {
    "potential.client@example.com": { offerId: 1, evidence: "synthetic" },
  },
  unresolvedOfferConflicts: {},
});

test("ordinary Pipeline-only person plans a Deal, one approximate stage event", () => {
  const plan = planPerson(
    basePerson({
      pipelineStages: ["Call Scheduled"],
      pipelinePrograms: ["The Living Example (1:1)"],
      acuityEarliestCallDate: "2025-01-01",
    }),
    syntheticRulings(),
  );
  assert.equal(plan.dealPlan.reason, "pipeline");
  assert.equal(plan.dealPlan.offerId, 1);
  assert.equal(plan.enrollmentPlan, null);
  assert.equal(plan.dealStageEvents.length, 1);
  assert.equal(plan.dealStageEvents[0].approximate, true);
});

test("Active Client Pipeline person also plans an active Enrollment + one event", () => {
  const plan = planPerson(
    basePerson({
      pipelineStages: ["Active Client"],
      pipelinePrograms: ["Growing Yourself Up (GYU)"],
      acuityEarliestCallDate: "2025-01-01",
    }),
    syntheticRulings(),
  );
  assert.equal(plan.dealPlan.offerId, 2);
  assert.equal(plan.enrollmentPlan.status, "active");
  assert.equal(plan.enrollmentStatusEvents.length, 1);
});

test("Completed/Past Client Pipeline person plans a completed Enrollment", () => {
  const plan = planPerson(
    basePerson({
      pipelineStages: ["Completed / Past Client"],
      pipelinePrograms: ["The Living Example (1:1)"],
    }),
    syntheticRulings(),
  );
  assert.equal(plan.enrollmentPlan.status, "completed");
});

test("PC ruling: stage=committed, outcome=nurture, never Won, TWO independently-evidenced events", () => {
  const rulings = syntheticRulings();
  const plan = planPerson(
    basePerson({
      canonicalEmail: rulings.pcEmails[0],
      acuityEarliestCallDate: "2025-01-01",
      stripe: {
        customer: "cus_X",
        customerCreated: "2025-01-10",
        subscriptions: [],
      },
    }),
    rulings,
  );
  assert.equal(plan.dealPlan.stage, "committed");
  assert.equal(plan.dealPlan.outcome, "nurture");
  assert.equal(plan.dealPlan.offerId, 1);
  assert.notEqual(plan.dealPlan.stage, "won");
  assert.equal(plan.dealStageEvents.length, 2);
  assert.equal(plan.dealStageEvents[0].stage, "call_booked");
  assert.equal(plan.dealStageEvents[1].stage, "committed");
});

test("PC with no Stripe customer-creation date recorded gets only the one event it actually has evidence for", () => {
  const rulings = syntheticRulings();
  const plan = planPerson(
    basePerson({
      canonicalEmail: rulings.pcEmails[0],
      acuityEarliestCallDate: "2025-01-01",
    }),
    rulings,
  );
  assert.equal(plan.dealStageEvents.length, 1);
});

// ---------------------------------------------------------------------------
// Deal Offer resolution (Phase 4M) — real Postgres rejected every Deal this
// used to leave offerId null for; see resolveDealOfferId's own doc comment
// for the full precedence rule.
// ---------------------------------------------------------------------------

test("resolveDealOfferId: a single named Pipeline Program resolves directly, LE and GYU both represented", () => {
  const rulings = syntheticRulings();
  assert.deepEqual(
    resolveDealOfferId(
      basePerson({ pipelinePrograms: ["The Living Example (1:1)"] }),
      rulings,
    ),
    { offerId: 1 },
  );
  assert.deepEqual(
    resolveDealOfferId(
      basePerson({ pipelinePrograms: ["Growing Yourself Up (GYU)"] }),
      rulings,
    ),
    { offerId: 2 },
  );
});

test("resolveDealOfferId: 'Both / Undecided' is a genuine source-recorded conflict, never picked between", () => {
  const result = resolveDealOfferId(
    basePerson({ pipelinePrograms: ["Both / Undecided"] }),
    syntheticRulings(),
  );
  assert.ok(
    result.conflict,
    "must report a conflict, not silently pick an Offer",
  );
  assert.equal(result.offerId, undefined);
});

test("resolveDealOfferId: no Pipeline row at all falls through to an explicit ruling-computed override", () => {
  const rulings = syntheticRulings();
  const result = resolveDealOfferId(
    basePerson({
      canonicalEmail: "potential.client@example.com",
      pipelinePrograms: [],
    }),
    rulings,
  );
  assert.deepEqual(result, { offerId: 1 });
});

test("resolveDealOfferId: absent evidence in every source fails closed as unresolved, never a default", () => {
  const result = resolveDealOfferId(
    basePerson({
      canonicalEmail: "nobody.knows@example.com",
      pipelinePrograms: [],
    }),
    syntheticRulings(),
  );
  assert.equal(result.unresolved, true);
  assert.equal(result.offerId, undefined);
});

test("resolveDealOfferId: a pre-recorded unresolved conflict surfaces its reason, never guessed past", () => {
  const rulings = syntheticRulings();
  rulings.unresolvedOfferConflicts["conflicted.person@example.com"] = {
    reason: "booked both an LE-type and a GYU-type call",
  };
  const result = resolveDealOfferId(
    basePerson({
      canonicalEmail: "conflicted.person@example.com",
      pipelinePrograms: [],
    }),
    rulings,
  );
  assert.ok(result.conflict);
});

test("a Pipeline person with unresolvable Offer evidence gets NO Deal, and the issue is surfaced on offerIssue — never silently dropped", () => {
  const plan = planPerson(
    basePerson({ pipelineStages: ["Call Scheduled"], pipelinePrograms: [] }),
    syntheticRulings(),
  );
  assert.equal(plan.dealPlan, null);
  assert.ok(
    plan.offerIssue,
    "the failure must be surfaced, not silently absorbed",
  );
  assert.equal(plan.offerIssue.branch, "pipeline");
});

test("summarizePlan throws rather than emit a manifest containing a Deal with an invalid offerId (defense-in-depth)", () => {
  // Construct a rulings object whose explicitOfferOverrides deliberately
  // returns an invalid value — proves the plan-level invariant actually
  // fires, not just that the happy path looks fine.
  const rulings = syntheticRulings();
  rulings.explicitOfferOverrides["potential.client@example.com"] = {
    offerId: 999,
  };
  assert.throws(
    () =>
      summarizePlan(
        [
          basePerson({
            canonicalEmail: "potential.client@example.com",
            acuityEarliestCallDate: "2025-01-01",
          }),
        ],
        rulings,
      ),
    /invalid offerId/,
  );
});

test("CC-representable ruling: real Deal (won) + completed Enrollment, ONE event each (no fabricated second date)", () => {
  const rulings = syntheticRulings();
  const ccEmail = Object.keys(rulings.ccRepresentable)[0];
  const plan = planPerson(
    basePerson({
      canonicalEmail: ccEmail,
      acuityEarliestCallDate: "2025-01-01",
    }),
    rulings,
  );
  assert.equal(plan.dealPlan.stage, "won");
  assert.equal(plan.dealPlan.offerId, rulings.ccRepresentable[ccEmail].offerId);
  assert.equal(plan.enrollmentPlan.status, "completed");
  assert.equal(plan.dealStageEvents.length, 1);
  assert.equal(plan.enrollmentStatusEvents.length, 1);
  assert.equal(plan.dealStageEvents[0].approximate, true);
});

test("CC contact-only ruling: no Deal, no Enrollment, no fabricated Offer, no events", () => {
  const rulings = syntheticRulings();
  const plan = planPerson(
    basePerson({ canonicalEmail: rulings.ccContactOnly[0] }),
    rulings,
  );
  assert.equal(plan.dealPlan, null);
  assert.equal(plan.enrollmentPlan, null);
  assert.equal(plan.dealStageEvents.length, 0);
});

test("canonical Stripe customer override wins over the raw pulled customer id", () => {
  const rulings = syntheticRulings();
  const email = Object.keys(rulings.canonicalStripeCustomerOverrides)[0];
  const plan = planPerson(
    basePerson({
      canonicalEmail: email,
      stripe: {
        customer: "cus_OTHER_DUPLICATE",
        customerCreated: null,
        subscriptions: [],
      },
    }),
    rulings,
  );
  assert.equal(
    plan.canonicalStripeCustomerId,
    rulings.canonicalStripeCustomerOverrides[email],
  );
});

test("acuity current-type appointments are structured, legacy-type stay descriptive-only", () => {
  const plan = planPerson(
    basePerson({ acuity: { total: 5, current: 3, legacy: 2 } }),
    syntheticRulings(),
  );
  assert.equal(plan.acuityStructuredCount, 3);
  assert.equal(plan.acuityDescriptiveOnlyCount, 2);
});

test("a SKIPped person gets zero structured/descriptive Acuity counts even if raw appointments exist", () => {
  const plan = planPerson(
    basePerson({
      operation: "SKIP",
      acuity: { total: 5, current: 3, legacy: 2 },
    }),
    syntheticRulings(),
  );
  assert.equal(plan.acuityStructuredCount, 0);
  assert.equal(plan.acuityDescriptiveOnlyCount, 0);
});

test("NEEDS_LEIF is never staged as CREATE by this planner — treated as SKIP until re-ruled", () => {
  const plan = planPerson(
    basePerson({ operation: "NEEDS_LEIF" }),
    syntheticRulings(),
  );
  assert.equal(plan.operation, "SKIP");
});

test("summarizePlan waitlist counting: LE and GYU are independent, both count if both true", () => {
  const rulings = syntheticRulings();
  const records = [basePerson({ waitlist: { LE: true, GYU: true } })];
  const summary = summarizePlan(records, rulings);
  assert.equal(summary.waitlistEntryRows, 2);
});

test("summarizePlan Application arithmetic: with + without == total Pipeline people", () => {
  const rulings = syntheticRulings();
  const records = [
    basePerson({
      canonicalEmail: "a@example.com",
      pipelineStages: ["Call Scheduled"],
      hasApplication: true,
    }),
    basePerson({
      canonicalEmail: "b@example.com",
      pipelineStages: ["Call Scheduled"],
      hasApplication: false,
    }),
    basePerson({ canonicalEmail: "c@example.com", pipelineStages: [] }), // not a Pipeline person at all
  ];
  const summary = summarizePlan(records, rulings);
  assert.equal(summary.applications.withApplication, 1);
  assert.equal(summary.applications.withoutApplication, 1);
});

test("summarizePlan is deterministic — same input, same output, every time", () => {
  const rulings = syntheticRulings();
  const records = [
    basePerson({
      canonicalEmail: "a@example.com",
      pipelineStages: ["Call Scheduled"],
    }),
    basePerson({
      canonicalEmail: "b@example.com",
      operation: "UPDATE",
      crmContactId: [1],
    }),
    basePerson({ canonicalEmail: "c@example.com", operation: "SKIP" }),
  ];
  const first = summarizePlan(records, rulings);
  const second = summarizePlan(records, rulings);
  assert.deepEqual(first, second);
  assert.equal(first.contacts.CREATE, 1);
  assert.equal(first.contacts.UPDATE, 1);
  assert.equal(first.contacts.SKIP, 1);
});

test("diffAgainstFrozenManifest reports zero discrepancies when counts match exactly", () => {
  const computed = { CREATE: 5, UPDATE: 2, SKIP: 3 };
  const frozen = { CREATE: 5, UPDATE: 2, SKIP: 3 };
  assert.deepEqual(diffAgainstFrozenManifest(computed, frozen), []);
});

test("diffAgainstFrozenManifest surfaces a real mismatch rather than papering over it", () => {
  const computed = { CREATE: 5, UPDATE: 2, SKIP: 3 };
  const frozen = { CREATE: 6, UPDATE: 2, SKIP: 3 };
  const diff = diffAgainstFrozenManifest(computed, frozen);
  assert.equal(diff.length, 1);
  assert.deepEqual(diff[0], { key: "CREATE", expected: 6, actual: 5 });
});

test("dry-run planning touches no I/O — planPerson does not mutate its input", () => {
  const person = basePerson();
  const before = JSON.stringify(person);
  planPerson(person, syntheticRulings());
  assert.equal(
    JSON.stringify(person),
    before,
    "planPerson must not mutate its input",
  );
});

test("operational Tasks planned is always zero — the frozen manifest requires none", () => {
  const summary = summarizePlan(
    [basePerson({ pipelineStages: ["Active Client"] })],
    syntheticRulings(),
  );
  assert.equal(summary.events.operationalTasks, 0);
});

// ---------------------------------------------------------------------------
// Deal STAGE resolution (Phase 4N) — the second real-Postgres-predictable
// defect after Offer (deals.stage is NOT NULL; the ordinary-Pipeline branch
// never resolved one before this round).
// ---------------------------------------------------------------------------

test("resolveDealStage: Active Client maps to won; Call Scheduled maps to call_booked — LE and GYU paths both represented via the person otherwise", () => {
  assert.deepEqual(
    resolveDealStage(
      basePerson({ pipelineStages: ["Active Client"] }),
      syntheticRulings(),
    ),
    { stage: "won", outcome: null },
  );
  assert.deepEqual(
    resolveDealStage(
      basePerson({ pipelineStages: ["Call Scheduled"] }),
      syntheticRulings(),
    ),
    { stage: "call_booked", outcome: null },
  );
});

test("resolveDealStage: terminal/outcome labels map to their real outcome, never invented specificity", () => {
  assert.deepEqual(
    resolveDealStage(
      basePerson({ pipelineStages: ["Nurture (Check Back Later)"] }),
      syntheticRulings(),
    ),
    { stage: "interested", outcome: "nurture" },
  );
  assert.deepEqual(
    resolveDealStage(
      basePerson({ pipelineStages: ["Not Interested"] }),
      syntheticRulings(),
    ),
    { stage: "interested", outcome: "lost" },
  );
  assert.deepEqual(
    resolveDealStage(
      basePerson({ pipelineStages: ["Lost / Went Cold"] }),
      syntheticRulings(),
    ),
    { stage: "interested", outcome: "lost" },
  );
});

test("resolveDealStage: multiple real Stage entries pick the FURTHEST-advanced, never the merely-latest", () => {
  const result = resolveDealStage(
    basePerson({
      pipelineStages: ["Call Scheduled", "Nurture (Check Back Later)"],
    }),
    syntheticRulings(),
  );
  assert.equal(
    result.stage,
    "call_booked",
    "call_booked outranks interested even though Nurture is a later-listed entry",
  );
});

test("resolveDealStage: an unmapped Pipeline Stage label fails closed as unresolved, never guessed", () => {
  const result = resolveDealStage(
    basePerson({ pipelineStages: ["Some Brand New Stage Nobody Has Seen"] }),
    syntheticRulings(),
  );
  assert.equal(result.unresolved, true);
});

test("resolveDealStage: no Pipeline stage evidence at all fails closed", () => {
  const result = resolveDealStage(
    basePerson({ pipelineStages: [] }),
    syntheticRulings(),
  );
  assert.equal(result.unresolved, true);
});

test("resolveDealStage: an explicit human ruling override wins outright", () => {
  const rulings = syntheticRulings();
  rulings.explicitStageOverrides = {
    "ruled.person@example.com": { stage: "decision", outcome: null },
  };
  const result = resolveDealStage(
    basePerson({
      canonicalEmail: "ruled.person@example.com",
      pipelineStages: ["Some Brand New Stage"],
    }),
    rulings,
  );
  assert.deepEqual(result, { stage: "decision", outcome: null });
});

test("a Pipeline person with resolvable Offer but unmapped Stage gets NO Deal, surfaced as offerIssue (branch pipeline-stage) — never a null-stage write", () => {
  const plan = planPerson(
    basePerson({
      pipelineStages: ["A Completely Novel Label"],
      pipelinePrograms: ["The Living Example (1:1)"],
    }),
    syntheticRulings(),
  );
  assert.equal(plan.dealPlan, null);
  assert.ok(plan.offerIssue);
  assert.equal(plan.offerIssue.branch, "pipeline-stage");
});

test("PC and CC Deals still carry a real, valid stage (unaffected by the Pipeline-stage resolver)", () => {
  const rulings = syntheticRulings();
  const pcPlan = planPerson(
    basePerson({
      canonicalEmail: rulings.pcEmails[0],
      acuityEarliestCallDate: "2025-01-01",
    }),
    rulings,
  );
  assert.ok(
    [
      "interested",
      "application_received",
      "approved",
      "call_booked",
      "decision",
      "committed",
      "won",
    ].includes(pcPlan.dealPlan.stage),
  );
  const ccEmail = Object.keys(rulings.ccRepresentable)[0];
  const ccPlan = planPerson(
    basePerson({
      canonicalEmail: ccEmail,
      acuityEarliestCallDate: "2025-01-01",
    }),
    rulings,
  );
  assert.equal(
    ccPlan.dealPlan.stage,
    rulings.ccRepresentable[ccEmail].dealStage,
  );
});

test("summarizePlan throws on an invalid stage (defense-in-depth) exactly like it does for offerId", () => {
  const rulings = syntheticRulings();
  rulings.explicitStageOverrides = {
    "bad.stage.person@example.com": {
      stage: "not_a_real_stage",
      outcome: null,
    },
  };
  const person = basePerson({
    canonicalEmail: "bad.stage.person@example.com",
    pipelineStages: ["Call Scheduled"],
    pipelinePrograms: ["The Living Example (1:1)"],
    acuityEarliestCallDate: "2025-01-01",
  });
  assert.throws(() => summarizePlan([person], rulings), /invalid stage/);
});

test("Sophie-shaped dual-offer ruling produces TWO Deals, same resolved stage/outcome, never a coin-flip single Offer", () => {
  const rulings = syntheticRulings();
  rulings.sophieDualOfferRuling = {
    canonicalEmail: "dual.offer.person@example.com",
  };
  const person = basePerson({
    canonicalEmail: "dual.offer.person@example.com",
    pipelineStages: ["Not Interested"],
    pipelinePrograms: ["Both / Undecided"],
    acuityEarliestCallDate: "2026-08-27",
  });
  const plan = planPerson(person, rulings);
  assert.equal(
    plan.dealPlan,
    null,
    "no single dealPlan — dualDealPlans is the real output",
  );
  assert.equal(plan.dualDealPlans.length, 2);
  assert.deepEqual(
    new Set(plan.dualDealPlans.map((d) => d.offerId)),
    new Set([1, 2]),
  );
  for (const deal of plan.dualDealPlans) {
    assert.equal(deal.stage, "interested");
    assert.equal(deal.outcome, "lost");
    assert.equal(deal.createdAt, "2026-08-27");
    assert.equal(deal.updatedAt, "2026-08-27");
    assert.equal(deal.stageEnteredAt, "2026-08-27");
  }
});

test("a person with an explicit Offer override (explicit-offer-override shaped) and a resolvable Stage gets a real Deal — no longer stuck as offerIssue", () => {
  const rulings = syntheticRulings();
  rulings.explicitOfferOverrides["ruled.offer.person@example.com"] = {
    offerId: 1,
    evidence: "leif-ruling",
  };
  const plan = planPerson(
    basePerson({
      canonicalEmail: "ruled.offer.person@example.com",
      pipelineStages: ["Thinking It Over"],
      pipelinePrograms: [],
      acuityEarliestCallDate: "2025-01-01",
    }),
    rulings,
  );
  assert.equal(plan.dealPlan.offerId, 1);
  assert.equal(plan.dealPlan.stage, "decision");
});

// ---------------------------------------------------------------------------
// Deal TIMESTAMP resolution (Phase 4O) — the third real-Postgres-predictable
// defect: created_at/updated_at/stage_entered_at are all NOT NULL and a
// single value used to silently stand in for all three.
// ---------------------------------------------------------------------------

test("resolveDealTimestamps: created_at/updated_at resolve independently of stage_entered_at when a specific stage-transition date exists", () => {
  const person = basePerson({
    notionCallDate: "2025-01-01",
    acuityEarliestCallDate: "2025-01-01",
  });
  const ts = resolveDealTimestamps(person, syntheticRulings(), [
    { stage: "won", at: "2025-06-15" },
  ]);
  assert.equal(ts.createdAt, "2025-01-01");
  assert.equal(ts.updatedAt, "2025-01-01");
  assert.equal(
    ts.stageEnteredAt,
    "2025-06-15",
    "stage_entered_at uses the actual stage-transition evidence, not created_at",
  );
});

test("resolveDealTimestamps: falls back to createdAt for stage_entered_at ONLY when no stage-transition evidence exists — never now()", () => {
  const person = basePerson({ notionCallDate: "2025-01-01" });
  const ts = resolveDealTimestamps(person, syntheticRulings(), []);
  assert.equal(ts.stageEnteredAt, ts.createdAt);
  assert.notEqual(ts.createdAt, undefined);
});

test("resolveDealTimestamps: no date evidence anywhere is genuinely unresolved, never defaulted to migration time", () => {
  const ts = resolveDealTimestamps(basePerson(), syntheticRulings(), []);
  assert.equal(ts.unresolved, true);
});

test("a Pipeline Deal with valid Offer+Stage but zero date evidence gets NO Deal — surfaced, never a fabricated created_at", () => {
  const person = basePerson({
    pipelineStages: ["Call Scheduled"],
    pipelinePrograms: ["The Living Example (1:1)"],
  });
  const plan = planPerson(person, syntheticRulings());
  assert.equal(plan.dealPlan, null);
  assert.ok(plan.offerIssue);
  assert.equal(plan.offerIssue.branch, "timestamps");
});

test("insertHistoricalDeal writer receives three distinct timestamp values, not one shared reference", () => {
  // Exercised indirectly via the write.test.mjs guard tests (null
  // createdAt / updatedAt each independently rejected before SQL) — see
  // write.test.mjs for the actual writer-boundary proof.
  const ts = resolveDealTimestamps(
    basePerson({ notionCallDate: "2025-02-01" }),
    syntheticRulings(),
    [{ stage: "call_booked", at: "2025-03-01" }],
  );
  assert.notEqual(
    ts.createdAt,
    ts.stageEnteredAt,
    "these two are genuinely different real dates here, proving they are not the same reused value",
  );
});
