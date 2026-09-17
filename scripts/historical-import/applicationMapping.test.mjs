// Synthetic-fixture tests only — no real applicant answers. Field names
// mirror the real Notion schema shape (fetched this session) but every
// value below is invented.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mapHistoricalAnswers,
  mapHistoricalStatus,
  LE_ANSWER_KEY_MAP,
  GYU_ANSWER_KEY_MAP,
  isJanuaryDatabaseConstructionArtifact,
} from "./applicationMapping.mjs";

test("LE: all 5 current-equivalent questions map to their current answer key", () => {
  const raw = {
    Email: "synthetic@example.com",
    "Your name:": "Synthetic Person",
    "1. What’s the main pattern, emotion, or relationship dynamic you’re struggling with right now? ":
      "synthetic pattern",
    "2. What have you already tried to change or shift this?":
      "synthetic prior attempt",
    "3. How are you hoping to change through working together?":
      "synthetic hoped change",
    "4. What are you hoping I will support you in this process?":
      "synthetic hoped support",
    "5. On a scale of 1–10, how committed are you to changing this pattern/way-of-being?":
      "8",
    Status: "Approved",
    "Submission time": "2026-01-01T00:00:00Z",
  };
  const { answers, mapped, preserved, dropped } = mapHistoricalAnswers(
    "LE",
    raw,
  );
  assert.equal(mapped, 5);
  assert.equal(preserved, 0);
  assert.equal(dropped, 0);
  assert.equal(answers.le_main_pattern, "synthetic pattern");
  assert.equal(answers.le_commitment_scale, "8");
  assert.equal(
    answers.Email,
    undefined,
    "identity fields must never appear in raw_answers",
  );
  assert.equal(
    answers.Status,
    undefined,
    "Status drives applications.status, not an answer",
  );
});

test("LE: the orphan therapist question is preserved under a historical-only key, never dropped or folded into le_hoped_support", () => {
  const raw = {
    "4. Are you currently working with a therapist or other support?":
      "synthetic: yes, weekly therapy",
  };
  const { answers, mapped, preserved, dropped } = mapHistoricalAnswers(
    "LE",
    raw,
  );
  assert.equal(
    dropped,
    0,
    "a known historical question must never be silently dropped",
  );
  assert.equal(preserved, 1);
  assert.equal(mapped, 0);
  assert.equal(
    answers.le_historical_therapist_support,
    "synthetic: yes, weekly therapy",
  );
  assert.equal(
    answers.le_hoped_support,
    undefined,
    "must never be folded into a different current question",
  );
});

test("GYU: all 4 questions map 1:1 to their current answer key, zero orphans", () => {
  const raw = {
    Email: "synthetic2@example.com",
    "Full Name": "Synthetic Two",
    "What’s the biggest challenge your facing in your personal growth and healing?":
      "synthetic challenge",
    "Why are you ready for support and change now?": "synthetic why now",
    "What are you hoping with program with Leif helps you create in your life and relationships?":
      "synthetic hoped outcome",
    "On a scale from 1-10 how ready are you to make a time, financial, and personal commitment to the change you want? ":
      "9",
    Notes:
      "synthetic staff-only note — must never appear as an applicant answer",
  };
  const { answers, mapped, preserved, dropped } = mapHistoricalAnswers(
    "GYU",
    raw,
  );
  assert.equal(mapped, 4);
  assert.equal(preserved, 0);
  assert.equal(dropped, 0);
  assert.equal(Object.keys(answers).length, 4);
  assert.equal(
    answers.Notes,
    undefined,
    "staff notes must never be imported as an applicant answer",
  );
});

test("an unrecognized field on a known-shape source row is reported as dropped, never silently discarded", () => {
  const raw = {
    "A brand new question nobody has seen before": "synthetic value",
  };
  const { dropped, droppedFields } = mapHistoricalAnswers("LE", raw);
  assert.equal(dropped, 1);
  assert.deepEqual(droppedFields, [
    "A brand new question nobody has seen before",
  ]);
});

test("empty/null/blank field values are skipped without counting as dropped", () => {
  const raw = {
    "1. What’s the main pattern, emotion, or relationship dynamic you’re struggling with right now? ":
      "",
    "2. What have you already tried to change or shift this?": null,
  };
  const { answers, mapped, dropped } = mapHistoricalAnswers("LE", raw);
  assert.equal(Object.keys(answers).length, 0);
  assert.equal(mapped, 0);
  assert.equal(dropped, 0);
});

test("mapHistoricalStatus maps every known historical Status value truthfully, never inventing a specific reason", () => {
  assert.equal(mapHistoricalStatus("Pending"), "pending");
  assert.equal(mapHistoricalStatus("Approved"), "approved");
  // Phase 4H correction: Denied must NEVER become not_fit (a specific
  // modern reason the source doesn't support), and Waitlist must NEVER
  // become pending (which would wrongly resurface a historical row in the
  // live Needs Review queue).
  assert.equal(mapHistoricalStatus("Denied"), "denied");
  assert.equal(mapHistoricalStatus("Waitlist"), "waitlist");
});

test("mapHistoricalStatus returns null (never guesses) for an unrecognized value", () => {
  assert.equal(mapHistoricalStatus("Some New Status"), null);
  assert.equal(mapHistoricalStatus(null), null);
  assert.equal(mapHistoricalStatus(undefined), null);
});

test("isJanuaryDatabaseConstructionArtifact flags exactly the two burst-copy timestamps, mechanically — never by name", () => {
  assert.equal(
    isJanuaryDatabaseConstructionArtifact("2026-08-27T16:24:15.000Z"),
    true,
  );
  assert.equal(
    isJanuaryDatabaseConstructionArtifact("2026-08-27T16:24:16.000Z"),
    true,
  );
  // The one genuine January-form submission, and any other real row, must
  // never match — even one second on either side of the burst window.
  assert.equal(
    isJanuaryDatabaseConstructionArtifact("2026-08-28T18:26:46.000Z"),
    false,
  );
  assert.equal(
    isJanuaryDatabaseConstructionArtifact("2026-08-27T16:24:14.000Z"),
    false,
  );
  assert.equal(
    isJanuaryDatabaseConstructionArtifact("2026-08-27T16:24:17.000Z"),
    false,
  );
});

test("LE and GYU key maps never collide with each other's target keys", () => {
  const leTargets = new Set(Object.values(LE_ANSWER_KEY_MAP));
  const gyuTargets = new Set(Object.values(GYU_ANSWER_KEY_MAP));
  for (const t of leTargets)
    assert.ok(!gyuTargets.has(t), `${t} must not be shared between LE and GYU`);
});
