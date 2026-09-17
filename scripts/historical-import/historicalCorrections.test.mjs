// Regression tests for the two historical facts the frozen generator could
// not previously express. Both are corrections to people who already exist
// and are otherwise already right, so most of what these prove is what the
// corrections must NEVER do: create a second Deal, invent an Application,
// make a withdrawn person look current, or restate a scholarship total as a
// per-payment amount.
//
// Driven through the REAL writer functions with a recording client, so the
// assertions are about the SQL that actually reaches Postgres. The same
// statements are proven end-to-end against a real database separately.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  commercialTermsFromRuling,
  termsAlreadyCorrect,
  reconcileDealCommercialTerms,
  applyFallWithdrawnRuling,
  resolveEnrolledAt,
  resolveWithdrawnAt,
} from "./historicalCorrections.mjs";

// A client that records every statement and answers the writer's
// check-then-insert probes as an empty target would.
const recordingClient = ({
  ledgerHit = null,
  existingEnrollment = null,
} = {}) => {
  const statements = [];
  let nextId = 900;
  return {
    statements,
    async query(text, params = []) {
      statements.push({ text: text.trim().replace(/\s+/g, " "), params });
      if (/from historical_import_records where entity_table/.test(text)) {
        return ledgerHit ? { rows: [{ entity_id: ledgerHit }] } : { rows: [] };
      }
      if (/select id from enrollments where opportunity_id/.test(text)) {
        return existingEnrollment
          ? { rows: [{ id: existingEnrollment }] }
          : { rows: [] };
      }
      if (/returning id/i.test(text)) return { rows: [{ id: nextId++ }] };
      return { rows: [] };
    },
  };
};

const writes = (client) =>
  client.statements.filter((s) => /^(insert|update|delete)/i.test(s.text));
const wrote = (client, re) => writes(client).filter((s) => re.test(s.text));

// The two real rulings these tests exist for.
const SAM_RULING = {
  name: "Sam Milz",
  cohortOfferId: 2,
  dealStage: "won",
  pricingMode: "scholarship",
  paymentTotal: 700,
  paymentPeriodMonths: 4,
};
const SIGRID_RULING = { name: "Sigrid Kipper Thau" };
const SIGRID_PERSON = {
  stripe: { customerCreated: "2026-08-05" },
  acuityEarliestCallDate: "2026-07-29",
  notionCallDate: "2026-07-29",
};
const KNOWN_BY = "2026-09-15";

// ---------------------------------------------------------------------------
// Sam Milz — scholarship commercial terms
// ---------------------------------------------------------------------------

test("a $700 total over 4 months is recorded as a $700 TOTAL, never $700 per payment", () => {
  const terms = commercialTermsFromRuling(SAM_RULING);

  assert.equal(terms.total, 700);
  assert.equal(terms.installments, 4);
  assert.equal(terms.installmentAmount, 175);
  // The failure this guards against: reading the ruling's total as the
  // per-payment figure, which would bill him 4x what was agreed.
  assert.notEqual(terms.installmentAmount, 700);
  assert.equal(terms.installmentAmount * terms.installments, terms.total);
});

test("a ruling that states only a total, or only a period, is rejected rather than half-inferred", () => {
  assert.throws(
    () => commercialTermsFromRuling({ name: "X", paymentTotal: 700 }),
    /only half a commercial arrangement/,
  );
  assert.throws(
    () => commercialTermsFromRuling({ name: "X", paymentPeriodMonths: 4 }),
    /only half a commercial arrangement/,
  );
});

test("a ruling with no commercial terms at all yields none, rather than a zero-priced arrangement", () => {
  assert.equal(commercialTermsFromRuling(SIGRID_RULING), null);
});

test("correcting Sam's Deal writes scholarship pricing and his agreed schedule, and touches nothing else", async () => {
  const client = recordingClient();

  const result = await reconcileDealCommercialTerms(client, {
    dealId: 184,
    ruling: SAM_RULING,
    currentTerms: { pm: "standard", t: null, n: null, a: null },
  });

  assert.equal(result.corrected, true);
  const updates = wrote(client, /^update deals/i);
  assert.equal(updates.length, 1, "exactly one Deal is updated");
  assert.deepEqual(updates[0].params, [184, "scholarship", 700, 4, 175]);

  // A commercial correction is not evidence that anybody exists twice.
  assert.equal(wrote(client, /insert into deals/i).length, 0);
  assert.equal(wrote(client, /insert into applications/i).length, 0);
  assert.equal(wrote(client, /insert into contacts/i).length, 0);
  assert.equal(wrote(client, /insert into enrollments/i).length, 0);

  // offer_price_snapshot is left to handle_deal_saved(), which derives it
  // from the Offer's scholarship_price — two writers for one field would
  // eventually disagree.
  assert.ok(!/offer_price_snapshot/.test(updates[0].text));
  // A bespoke accommodation is not an entry in the Offer's public catalog.
  assert.ok(!/selected_payment_option_id/.test(updates[0].text));
});

test("re-correcting an already-correct Deal issues no SQL at all", async () => {
  const client = recordingClient();

  const result = await reconcileDealCommercialTerms(client, {
    dealId: 184,
    ruling: SAM_RULING,
    // Postgres numeric comes back as a string; it is the same fact.
    currentTerms: { pm: "scholarship", t: "700.00", n: 4, a: "175.00" },
  });

  assert.equal(result.corrected, false);
  assert.equal(client.statements.length, 0);
});

test("termsAlreadyCorrect treats a Deal with no terms as needing correction, not as matching", () => {
  const terms = commercialTermsFromRuling(SAM_RULING);
  assert.equal(termsAlreadyCorrect(undefined, "scholarship", terms), false);
  assert.equal(
    termsAlreadyCorrect(
      { pm: "standard", t: null, n: null, a: null },
      "scholarship",
      terms,
    ),
    false,
  );
  // Right money, wrong mode is still wrong.
  assert.equal(
    termsAlreadyCorrect(
      { pm: "standard", t: "700.00", n: 4, a: "175.00" },
      "scholarship",
      terms,
    ),
    false,
  );
});

// ---------------------------------------------------------------------------
// Sigrid — a real enrollment that really ended
// ---------------------------------------------------------------------------

test("the enrollment date comes from real evidence, preferring proof of sign-up over proof of a conversation", () => {
  assert.equal(resolveEnrolledAt(SIGRID_RULING, SIGRID_PERSON), "2026-08-05");
  // Without Stripe evidence it falls back to the call date rather than inventing one.
  assert.equal(
    resolveEnrolledAt(SIGRID_RULING, { acuityEarliestCallDate: "2026-07-29" }),
    "2026-07-29",
  );
  assert.equal(resolveEnrolledAt(SIGRID_RULING, {}), null);
});

test("an inferred withdrawal date is labelled as a known-by bound, never as something the source said", () => {
  const inferred = resolveWithdrawnAt(SIGRID_RULING, KNOWN_BY);
  assert.equal(inferred.at, KNOWN_BY);
  assert.match(inferred.evidence, /KNOWN_BY_SOURCE_CAPTURE/);
  assert.match(inferred.evidence, /NOT_A_CONFIRMED_DATE/);

  // A ruling that does state the date is recorded as the real thing.
  const ruled = resolveWithdrawnAt({ withdrawnAt: "2026-08-20" }, KNOWN_BY);
  assert.equal(ruled.at, "2026-08-20");
  assert.match(ruled.evidence, /RULED_SOURCE_DATE/);
});

test("Sigrid's withdrawal writes a terminal Enrollment plus BOTH transitions, and no second Deal or Application", async () => {
  const client = recordingClient();

  const result = await applyFallWithdrawnRuling(client, {
    email: "sigridkipperthau@gmail.com",
    ruling: SIGRID_RULING,
    person: SIGRID_PERSON,
    dealId: 154,
    batchId: "test-batch",
    alreadyEnrolled: false,
    knownByDate: KNOWN_BY,
  });

  assert.equal(result.written, true);
  assert.equal(result.statusEvents, 2);

  const enrollments = wrote(client, /insert into enrollments/i);
  assert.equal(enrollments.length, 1, "exactly one Enrollment");
  const [opportunityId, status, startDate, endDate] = enrollments[0].params;
  assert.equal(opportunityId, 154, "attached to her EXISTING Deal");
  assert.equal(status, "withdrawn");
  assert.equal(startDate, "2026-08-05", "she really did enrol, on a real date");
  assert.equal(
    endDate,
    null,
    "the source holds no withdrawal date to put here",
  );

  // She did not complete the programme, and the Clients list renders
  // "completed" as that literal word.
  assert.notEqual(status, "completed");
  // Nor is she still a client.
  assert.notEqual(status, "active");
  assert.notEqual(status, "onboarding");
  assert.notEqual(status, "offboarding");

  const events = wrote(client, /insert into enrollment_status_events/i);
  assert.equal(events.length, 2, "both transitions, not just the ending");
  assert.deepEqual(
    events.map((e) => e.params[1]),
    ["active", "withdrawn"],
    "in the order they happened",
  );
  assert.equal(events[0].params[2], "2026-08-05");
  assert.equal(events[1].params[2], KNOWN_BY);

  // A withdrawal is not evidence of another relationship or a submission.
  assert.equal(wrote(client, /insert into deals/i).length, 0);
  assert.equal(wrote(client, /insert into applications/i).length, 0);
  assert.equal(wrote(client, /insert into contacts/i).length, 0);
  assert.equal(
    wrote(client, /^update deals/i).length,
    0,
    "her Deal is untouched",
  );
});

test("the withdrawal is provenance-stamped with its date confidence", async () => {
  const client = recordingClient();
  await applyFallWithdrawnRuling(client, {
    email: "sigridkipperthau@gmail.com",
    ruling: SIGRID_RULING,
    person: SIGRID_PERSON,
    dealId: 154,
    batchId: "test-batch",
    alreadyEnrolled: false,
    knownByDate: KNOWN_BY,
  });

  const ledger = wrote(client, /insert into historical_import_records/i);
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].params[0], "enrollments");
  assert.match(String(ledger[0].params[2]), /ruling-fall-withdrawn/);
  assert.match(String(ledger[0].params[6]), /NOT_A_CONFIRMED_DATE/);
});

test("a withdrawal with no dated evidence of enrolment is refused rather than dated now()", async () => {
  const client = recordingClient();
  await assert.rejects(
    () =>
      applyFallWithdrawnRuling(client, {
        email: "nobody@example.com",
        ruling: SIGRID_RULING,
        person: {},
        dealId: 154,
        batchId: "test-batch",
        alreadyEnrolled: false,
        knownByDate: KNOWN_BY,
      }),
    /refusing to invent one/,
  );
  assert.equal(writes(client).length, 0);
});

test("a withdrawal with no Deal to attach to is refused rather than given a fabricated one", async () => {
  const client = recordingClient();
  await assert.rejects(
    () =>
      applyFallWithdrawnRuling(client, {
        email: "nobody@example.com",
        ruling: SIGRID_RULING,
        person: SIGRID_PERSON,
        dealId: null,
        batchId: "test-batch",
        alreadyEnrolled: false,
        knownByDate: KNOWN_BY,
      }),
    /only meaningful against the relationship it ended/,
  );
  assert.equal(writes(client).length, 0);
});

// ---------------------------------------------------------------------------
// Idempotency — the property that makes re-running the import safe
// ---------------------------------------------------------------------------

test("a second run writes nothing for either correction", async () => {
  // Sam: the target already records the corrected terms.
  const samClient = recordingClient();
  await reconcileDealCommercialTerms(samClient, {
    dealId: 184,
    ruling: SAM_RULING,
    currentTerms: { pm: "scholarship", t: "700.00", n: 4, a: "175.00" },
  });
  assert.equal(writes(samClient).length, 0);

  // Sigrid: the Deal already carries her Enrollment.
  const viaTargetState = recordingClient();
  const alreadyThere = await applyFallWithdrawnRuling(viaTargetState, {
    email: "sigridkipperthau@gmail.com",
    ruling: SIGRID_RULING,
    person: SIGRID_PERSON,
    dealId: 154,
    batchId: "test-batch",
    alreadyEnrolled: true,
    knownByDate: KNOWN_BY,
  });
  assert.equal(alreadyThere.written, false);
  assert.equal(writes(viaTargetState).length, 0);

  // And independently: even if the caller's view of enrollment were stale,
  // the provenance ledger stops a duplicate at the writer.
  const viaLedger = recordingClient({ ledgerHit: 35 });
  const replayed = await applyFallWithdrawnRuling(viaLedger, {
    email: "sigridkipperthau@gmail.com",
    ruling: SIGRID_RULING,
    person: SIGRID_PERSON,
    dealId: 154,
    batchId: "test-batch",
    alreadyEnrolled: false,
    knownByDate: KNOWN_BY,
  });
  assert.equal(replayed.written, false);
  assert.equal(writes(viaLedger).length, 0);
});
