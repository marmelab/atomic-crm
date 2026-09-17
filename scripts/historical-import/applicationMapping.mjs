// Historical Migration slice — maps a raw historical Notion application
// record (LE "1:1 Questionnaire" or GYU "Growing Yourself Up App") into the
// CURRENT Application representation (applications.raw_answers, a free-form
// jsonb — see 01_tables.sql). Pure, zero I/O, zero real client data.
//
// Historical truth outranks forcing old answers into today's questionnaire
// (Phase 4G, Part 3). A historical question that has no current equivalent
// is preserved under an explicit historical-only key — never discarded,
// never folded into an unrelated current question just because both are
// "about support" or "about commitment."
//
// Source: this session's live fetch of both original Notion data sources
// (collection 340f43ae-a3ef-81b6-9428-000bccf7d2e6 for LE,
// 3a8f43ae-a3ef-8047-a7a6-000b274629da for GYU — see
// scripts/historical-import/data/notion_le_questionnaire.json /
// notion_gyu_app.json, gitignored, real data only).

/** @typedef {"LE"|"GYU"} HistoricalProgram */

// LE "1:1 Questionnaire" question -> current answerLabels.ts key (see
// src/components/atomic-crm/applications/answerLabels.ts). 5 of the 6
// historical question columns have a direct current equivalent; the
// "currently working with a therapist" question does NOT (the current LE
// form never asks it) — preserved verbatim under a historical-only key
// rather than dropped or mapped onto le_hoped_support (a different
// question: "what support do you want from ME", not "what support do you
// already have").
export const LE_ANSWER_KEY_MAP = {
  "1. What’s the main pattern, emotion, or relationship dynamic you’re struggling with right now? ":
    "le_main_pattern",
  "2. What have you already tried to change or shift this?":
    "le_prior_attempts",
  "3. How are you hoping to change through working together?":
    "le_hoped_change",
  "4. What are you hoping I will support you in this process?":
    "le_hoped_support",
  "5. On a scale of 1–10, how committed are you to changing this pattern/way-of-being?":
    "le_commitment_scale",
  // No current-form equivalent — see module doc above.
  "4. Are you currently working with a therapist or other support?":
    "le_historical_therapist_support",
};

// GYU "Growing Yourself Up App" question -> current answerLabels.ts key.
// All 4 historical questions map 1:1 to the current form; no orphan.
export const GYU_ANSWER_KEY_MAP = {
  "What’s the biggest challenge your facing in your personal growth and healing?":
    "gyu_biggest_challenge",
  "Why are you ready for support and change now?": "gyu_why_now",
  "What are you hoping with program with Leif helps you create in your life and relationships?":
    "gyu_hoped_outcome",
  "On a scale from 1-10 how ready are you to make a time, financial, and personal commitment to the change you want? ":
    "gyu_commitment_scale",
};

// Fields present in the raw Notion row that are NEVER applicant answers —
// identity (Email, Your name/Full Name), staff-internal notes (My notes /
// Notes — Leif's own review notes, not something the applicant said),
// system-managed metadata (Respondent, Submission time, Status, Call
// Booked). Importing these into raw_answers would misrepresent Leif's own
// notes as something the applicant said.
const NON_ANSWER_FIELDS = new Set([
  "Email",
  "Your name:",
  "Full Name",
  "My notes",
  "Notes",
  "Respondent",
  "Submission time",
  "Status",
  "Call Booked",
]);

// Notion Status -> current applications.status. Phase 4H correction: an
// earlier draft of this map used Denied->not_fit and Waitlist->pending —
// both WRONG. 'Denied' proves a decline occurred, never a *specific*
// modern reason (not_fit is a specific, different claim); 'Waitlist' is a
// real historical disposition, not "no decision yet" (pending) — and
// 'pending' specifically drives the LIVE Needs Review queue
// (useApplicationsGrouped.ts), which would wrongly resurface a
// months-old historical row today. 01_tables.sql proposes (undeployed)
// adding 'denied' and 'waitlist' as historical-import-only status values
// for exactly this reason — see that file's comment on
// applications_status_check.
export const STATUS_MAP = {
  Pending: "pending",
  Approved: "approved",
  Denied: "denied",
  Waitlist: "waitlist",
};

/**
 * Map one raw historical Notion application row's fields into the current
 * Application's raw_answers shape, tracking mapped/preserved/dropped counts
 * for auditability. A "dropped" count above 0 means the source schema
 * changed since this map was written and must be investigated — it should
 * never happen for a known field.
 *
 * @param {HistoricalProgram} program
 * @param {Record<string, unknown>} rawFields - every column from the source row.
 */
export function mapHistoricalAnswers(program, rawFields) {
  const keyMap = program === "LE" ? LE_ANSWER_KEY_MAP : GYU_ANSWER_KEY_MAP;
  const answers = {};
  let mapped = 0;
  let preserved = 0;
  let dropped = 0;
  const droppedFields = [];

  for (const [notionKey, value] of Object.entries(rawFields)) {
    if (NON_ANSWER_FIELDS.has(notionKey)) continue;
    if (value === null || value === undefined || value === "") continue;

    const targetKey = keyMap[notionKey];
    if (!targetKey) {
      dropped++;
      droppedFields.push(notionKey);
      continue;
    }
    answers[targetKey] = value;
    if (
      targetKey.startsWith("le_historical_") ||
      targetKey.startsWith("gyu_historical_")
    ) {
      preserved++;
    } else {
      mapped++;
    }
  }

  return { answers, mapped, preserved, dropped, droppedFields };
}

/**
 * Map a historical Notion Status value to the current applications.status
 * enum. Returns null (never guesses) for an unrecognized value — the
 * caller must treat that as NEEDS_LEIF, not default to 'pending'.
 *
 * @param {string|null|undefined} notionStatus
 */
export function mapHistoricalStatus(notionStatus) {
  if (!notionStatus) return null;
  return STATUS_MAP[notionStatus] ?? null;
}

// Phase 4I: on 2026-08-27 the January-specific GYU application database was
// stood up by an unfiltered whole-table copy of the Fall database — 56 rows
// written in a two-second burst (createdTime exactly 2026-08-27T16:24:15Z
// or 2026-08-27T16:24:16Z). These are construction artifacts, not
// applications: they must never become a Contact, an Application, or a
// second application event for someone whose real application is the
// original-form row, and their (Notion-reset) Submission time must never
// be read as a real date. The exclusion is DELIBERATELY mechanical
// (createdTime match) — never name- or email-matched — per the forensic
// handoff's own instruction, so it can never accidentally exclude a
// genuine submission that merely happens to share a name/email pattern.
const JANUARY_ARTIFACT_CREATED_TIMES = new Set([
  "2026-08-27T16:24:15.000Z",
  "2026-08-27T16:24:16.000Z",
]);

/**
 * @param {string} createdTime - ISO-8601 createdTime of a January GYU
 *   application database row.
 * @returns {boolean} true when this row is a construction artifact, not a
 *   genuine submission.
 */
export function isJanuaryDatabaseConstructionArtifact(createdTime) {
  return JANUARY_ARTIFACT_CREATED_TIMES.has(createdTime);
}
