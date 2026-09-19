// Synthetic fixtures only — no real applicant answers, names or emails.
// The shapes mirror the real exports; every value below is invented.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  COPY_ARTIFACT_INSTANTS,
  bindRows,
  canonicalize,
  classifyAdditional,
  detectOffset,
  hashOf,
  isCopyArtifactInstant,
  parseCsv,
  parseExportTime,
  partitionSourceRows,
  planImportWrites,
  toMinute,
} from "./notionExportCapture.mjs";

test("parses a CSV whose answers contain commas, quotes and newlines", () => {
  // Arrange — the three things that break a naive split(",").
  const csv =
    "Full Name,Email,Submission time,Answer\n" +
    'Ada,a@example.test,"July 26, 2026 10:22 AM","He said ""no"", then\nleft."\n';

  // Act
  const rows = parseCsv(csv);

  // Assert
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], [
    "Full Name",
    "Email",
    "Submission time",
    "Answer",
  ]);
  assert.equal(rows[1][2], "July 26, 2026 10:22 AM");
  assert.equal(rows[1][3], 'He said "no", then\nleft.');
});

test("strips a byte order mark so the first column keeps its name", () => {
  // Arrange / Act
  const rows = parseCsv("﻿Full Name,Email\nAda,a@example.test\n");

  // Assert
  assert.equal(rows[0][0], "Full Name");
});

test("reads the export's local timestamp at a given offset", () => {
  // Arrange / Act / Assert
  assert.equal(
    parseExportTime("July 26, 2026 10:22 AM", -6),
    Date.UTC(2026, 6, 26, 16, 22),
  );
  assert.equal(
    parseExportTime("July 26, 2026 12:05 AM", -6),
    Date.UTC(2026, 6, 26, 6, 5),
  );
  assert.equal(
    parseExportTime("July 26, 2026 12:05 PM", -6),
    Date.UTC(2026, 6, 26, 18, 5),
  );
});

test("refuses a timestamp it does not recognise instead of guessing", () => {
  // Arrange / Act / Assert
  assert.equal(parseExportTime("2026-07-26T10:22", -6), null);
  assert.equal(parseExportTime("Smarch 4, 2026 1:00 PM", -6), null);
  assert.equal(parseExportTime("", -6), null);
  assert.equal(parseExportTime(null, -6), null);
});

test("derives the timezone from the data rather than assuming one", () => {
  // Arrange — Notion's instants, and the same moments as the CSV renders
  // them. Only one offset can reconcile every row.
  const notion = ["2026-07-26 16:22:04Z", "2026-09-15 13:05:39Z"];
  const minutes = new Set(notion.map(toMinute));
  const exported = ["July 26, 2026 10:22 AM", "September 15, 2026 7:05 AM"];

  // Act
  const offsets = detectOffset(exported, minutes);

  // Assert
  assert.deepEqual(offsets, [-6]);
});

test("reports no offset at all when the export cannot be reconciled", () => {
  // Arrange — a row that matches no known instant under any offset.
  const minutes = new Set([toMinute("2026-07-26 16:22:04Z")]);

  // Act
  const offsets = detectOffset(["July 26, 2026 10:23 AM"], minutes);

  // Assert — a refusal, so a caller cannot proceed on a wrong timezone.
  assert.deepEqual(offsets, []);
});

const notionRows = [
  { pageId: "aaa", instant: "2026-07-26 16:22:04Z", status: "Approved" },
  { pageId: "bbb", instant: "2026-09-15 13:05:39Z", status: "Pending" },
  { pageId: "cp1", instant: COPY_ARTIFACT_INSTANTS[0], status: "Approved" },
  { pageId: "cp2", instant: COPY_ARTIFACT_INSTANTS[0], status: "Approved" },
  { pageId: "cp3", instant: COPY_ARTIFACT_INSTANTS[1], status: "Denied" },
];

test("binds a row when its instant names exactly one page", () => {
  // Arrange / Act
  const [first, second] = bindRows({
    times: ["July 26, 2026 10:22 AM", "September 15, 2026 7:05 AM"],
    notionRows,
    offset: -6,
  });

  // Assert
  assert.equal(first.pageId, "aaa");
  assert.equal(first.binding, "submission_time_unique");
  assert.equal(first.isCopyArtifact, false);
  assert.equal(second.pageId, "bbb");
  assert.equal(second.submittedAt, "2026-09-15T13:05:00.000Z");
});

test("leaves the whole-table copy unbound instead of guessing a row", () => {
  // Arrange — two pages share the copy instant, so nothing distinguishes
  // the rows that came from them.
  const bound = bindRows({
    times: ["August 27, 2026 10:24 AM", "August 27, 2026 10:24 AM"],
    notionRows,
    offset: -6,
  });

  // Assert
  for (const r of bound) {
    assert.equal(r.pageId, null);
    assert.equal(r.binding, "unbound_ambiguous_instant");
    assert.equal(r.isCopyArtifact, true);
  }
});

test("recognises the copy instants the January database was built at", () => {
  // Arrange / Act / Assert
  assert.equal(isCopyArtifactInstant("2026-08-27T16:24:15Z"), true);
  assert.equal(isCopyArtifactInstant("2026-08-27T16:24:16Z"), true);
  assert.equal(isCopyArtifactInstant("2026-08-27T16:24:17Z"), false);
  assert.equal(isCopyArtifactInstant("2026-08-28T18:26:46Z"), false);
});

test("never binds one Notion page to two exported rows", () => {
  // Arrange — the same instant twice against a single page.
  const bound = bindRows({
    times: ["July 26, 2026 10:22 AM", "July 26, 2026 10:22 AM"],
    notionRows,
    offset: -6,
  });

  // Assert
  assert.equal(bound[0].pageId, "aaa");
  assert.equal(bound[1].pageId, null);
});

test("removes copy artifacts before counting what the CRM is missing", () => {
  // Arrange — the naive subtraction (all rows minus known) would call the
  // artifacts missing Applications. They are evidence of a copy.
  const rows = [
    { pageId: "aaa", isCopyArtifact: false },
    { pageId: "new", isCopyArtifact: false },
    { pageId: null, isCopyArtifact: true },
    { pageId: null, isCopyArtifact: true },
  ];

  // Act
  const split = partitionSourceRows(rows, new Set(["aaa"]));

  // Assert
  assert.equal(split.copyArtifacts.length, 2);
  assert.equal(split.alreadyInCrm.length, 1);
  assert.equal(split.genuinelyAdditional.length, 1);
  assert.equal(split.unbound.length, 0);
});

test("hashes the canonical form, so identical rows are one snapshot", () => {
  // Arrange
  const columns = ["Full Name", "Answer"];

  // Act
  const a = hashOf(canonicalize(columns, ["Ada", "yes"]));
  const b = hashOf(canonicalize(columns, ["Ada", "yes"]));
  const changed = hashOf(canonicalize(columns, ["Ada", "yes."]));
  const reordered = hashOf(
    canonicalize(["Answer", "Full Name"], ["yes", "Ada"]),
  );

  // Assert
  assert.equal(a, b);
  assert.notEqual(a, changed); // an edit upstream becomes a second version
  assert.notEqual(a, reordered); // column order is part of the evidence
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("a blank answer is preserved, not dropped", () => {
  // Arrange / Act
  const withBlank = canonicalize(["Q1", "Q2"], ["", "answered"]);

  // Assert — "asked and left empty" must stay distinguishable from "never
  // asked", which is the whole reason raw_answers = {} was so damaging.
  assert.equal(JSON.parse(withBlank).values.length, 2);
  assert.equal(JSON.parse(withBlank).values[0], "");
});

test("classifies an additional row only when identity is certain", () => {
  // Arrange / Act / Assert
  assert.equal(
    classifyAdditional({
      hasEmail: true,
      contactsByEmail: 1,
      opportunitiesForOffer: 1,
      activeOpportunity: true,
    }),
    "A",
  );
  assert.equal(
    classifyAdditional({
      hasEmail: true,
      contactsByEmail: 1,
      opportunitiesForOffer: 0,
    }),
    "B",
  );
  assert.equal(classifyAdditional({ hasEmail: true, contactsByEmail: 0 }), "C");
  assert.equal(
    classifyAdditional({ hasEmail: true, existingApplicationForPage: true }),
    "D",
  );
  assert.equal(classifyAdditional({ hasEmail: true, contactsByEmail: 2 }), "E");
  assert.equal(
    classifyAdditional({
      hasEmail: true,
      contactsByEmail: 1,
      opportunitiesForOffer: 3,
    }),
    "F",
  );
});

test("a person with no email is never silently created", () => {
  // Arrange — every other identity in this system is keyed on email.
  // Act / Assert
  assert.equal(
    classifyAdditional({ hasEmail: false, contactsByEmail: 0 }),
    "E",
  );
  assert.equal(classifyAdditional({ hasEmail: false, contactsByName: 0 }), "E");
});

test("a submission after an Opportunity ended is not attached silently", () => {
  // Arrange — one Opportunity, but it already carries an exit.
  // Act
  const verdict = classifyAdditional({
    hasEmail: true,
    contactsByEmail: 1,
    opportunitiesForOffer: 1,
    activeOpportunity: false,
  });

  // Assert — a decision, not an automatic reactivation.
  assert.equal(verdict, "G");
});

// The locked import decisions for the three genuinely additional rows.
// Synthetic evidence only — no real applicant, no real email.

test("a brand-new applicant creates the whole chain", () => {
  // Arrange — Case 1's shape: email present, nobody matches.
  const plan = planImportWrites({
    pageId: "p-new",
    hasEmail: true,
    contactId: null,
    offer: "Growing Yourself Up",
    submittedAt: "2026-09-18T20:18:00.000Z",
  });

  // Assert
  assert.equal(plan.reason, "new_contact");
  assert.deepEqual(plan.creates, [
    "contact",
    "opportunity",
    "application",
    "review_application_task",
    "snapshot_link",
  ]);
  assert.equal(plan.opportunity.stage, "application_received");
  assert.equal(plan.opportunity.cohort_id, null);
  assert.equal(plan.opportunity.outcome, null);
  assert.equal(plan.application.status, "pending");
  assert.equal(plan.application.reviewed_at, null);
  assert.equal(plan.application.intended_cohort_id, null);
  assert.equal(plan.application.submitted_at, "2026-09-18T20:18:00.000Z");
});

test("the source is the historical vocabulary, never the public form", () => {
  // Arrange / Act — it did not come through the CRM's own form, and
  // saying otherwise would misstate where the submission came from.
  const plan = planImportWrites({
    pageId: "p-new",
    hasEmail: true,
    contactId: null,
    offer: "Growing Yourself Up",
  });

  // Assert
  assert.equal(plan.application.source, "historical_import");
});

test("a later submission after a closed attempt opens a NEW one", () => {
  // Arrange — Case 3's shape: the person exists, their only Opportunity
  // ended with an outcome.
  const plan = planImportWrites({
    pageId: "p-again",
    hasEmail: true,
    contactId: 110,
    offer: "The Living Example",
    submittedAt: "2026-08-21T00:45:00.000Z",
  });

  // Assert — a new attempt, and no Contact is created for someone who
  // already exists.
  assert.equal(plan.reason, "new_sales_attempt");
  assert.ok(!plan.creates.includes("contact"));
  assert.ok(plan.creates.includes("opportunity"));
  assert.ok(plan.creates.includes("application"));
  // Nothing in the plan touches the closed Opportunity or its Application.
  assert.ok(!JSON.stringify(plan).includes("outcome_cleared"));
  assert.equal(plan.opportunity.outcome, null);
});

test("a name with no email stays evidence, and creates nothing", () => {
  // Arrange — Case 2's shape.
  const plan = planImportWrites({
    pageId: "p-noemail",
    hasEmail: false,
    contactId: null,
    offer: "The Living Example",
  });

  // Assert
  assert.deepEqual(plan.creates, []);
  assert.equal(plan.reason, "evidence_only_identity_insufficient");
});

test("a copy artifact never becomes a business record", () => {
  // Arrange — one of the 56 rows the January database copy created.
  const plan = planImportWrites({
    pageId: "p-copy",
    isCopyArtifact: true,
    hasEmail: true,
    contactId: null,
    offer: "Growing Yourself Up",
  });

  // Assert — even with a perfectly good email and no conflicting identity.
  assert.deepEqual(plan.creates, []);
  assert.equal(plan.reason, "copy_artifact");
});

test("re-running the import plans nothing the second time", () => {
  // Arrange — the same source page, already imported once.
  const first = planImportWrites({
    pageId: "p-new",
    hasEmail: true,
    contactId: null,
    offer: "Growing Yourself Up",
  });
  const second = planImportWrites({
    pageId: "p-new",
    hasEmail: true,
    contactId: null,
    offer: "Growing Yourself Up",
    alreadyImported: true,
  });

  // Assert
  assert.equal(first.creates.length, 5);
  assert.deepEqual(second.creates, []);
  assert.equal(second.reason, "already_imported");
});

test("the plan carries the source page, which is what the guard keys on", () => {
  // Arrange / Act
  const plan = planImportWrites({
    pageId: "p-new",
    hasEmail: true,
    contactId: null,
    offer: "Growing Yourself Up",
  });

  // Assert — a unique index on this column is what makes a concurrent
  // re-run collide instead of duplicating.
  assert.equal(plan.application.source_page_id, "p-new");
});
