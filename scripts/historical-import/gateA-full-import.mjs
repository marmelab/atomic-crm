// Gate A full-volume import generator. Builds the ENRICHED person records
// the real orchestrator needs (matched Applications, structured Acuity
// appointments, waitlist join dates) from the same gitignored sources the
// manifest generator uses, runs the REAL unmodified importPerson() for
// every one of them through the SQL-capturing shim, and emits one
// transactional SQL file for execution against the disposable project.
//
// Usage: node gateA-full-import.mjs <outfile> <nextIdsFile> <targetStateFile> [priorStateFile]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importPerson } from "./orchestrate.mjs";
import { makeShimClient } from "./gateA-sql-shim.mjs";
import { isJanuaryDatabaseConstructionArtifact } from "./applicationMapping.mjs";
import { applyIdentitySplitRulings } from "./plan.mjs";
import { insertHistoricalDeal, insertHistoricalEnrollment } from "./write.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, "data");
const TOOLRES =
  "/Users/NatashaMKraus/.claude/projects/-Users-NatashaMKraus-Projects-leif-crm-atomic/cae43b8a-0f64-40d9-a657-9ea9e1a75be9/tool-results";
const readJSON = (p) => JSON.parse(fs.readFileSync(path.join(DATA, p), "utf8"));
const normEmail = (e) => (e || "").trim().toLowerCase().replace(/\s+/g, "");
const splitEmails = (raw) =>
  (raw || "").split(",").map(normEmail).filter(Boolean);
const pageId = (url) => (url.match(/([0-9a-f]{32})/i) || [])[1];

const [, , outFile, nextIdsFile, targetStateFile, priorStateFile] =
  process.argv;

const staging = readJSON("phase3_staging_reproduced.json");
const rulings = readJSON("rulings.json");
const leApp = readJSON("notion_le_questionnaire.json");
const leAppNoEmail = readJSON("notion_le_questionnaire_noemail.json");
const pipelineLeLinks = readJSON("pipeline_le_application_links.json");
const gyuApp = readJSON("notion_gyu_app.json");
const janFormApp = readJSON("notion_jan_form_gyu_app.json");
const janWaitlist = readJSON("notion_jan_gyu_waitlist.json");
const leWaitlist = readJSON("notion_le_waitlist.json");
const acuityAppts = JSON.parse(
  fs.readFileSync(
    path.join(
      TOOLRES,
      "mcp-3775a279-3f10-4f86-b614-eed2a51c45ad-execute_zapier_read_action-1789497231301.txt",
    ),
    "utf8",
  ),
).results[0].body;

// ---------------------------------------------------------------------------
// Build the canonical person universe: the reproduced staging baseline plus
// the deterministic new people the Application sources introduce.
// ---------------------------------------------------------------------------
// Rulings outrank the staging manifest's identity decisions — a merge a
// ruling forbids is undone before the universe is built, exactly as the
// manifest generator does it, so the two can never disagree about who
// exists.
const people = applyIdentitySplitRulings(staging.records, rulings).map((r) => ({
  ...r,
  matchedApplications: [],
  structuredAcuityAppointments: [],
  waitlistJoinedAt: {},
}));
const byEmail = new Map();
for (const p of people) {
  for (const e of new Set([
    ...splitEmails(p.canonicalEmail),
    ...(p.altEmails || []).flatMap(splitEmails),
  ]))
    byEmail.set(e, p);
}

function ensurePerson(email, name, sourceSystem) {
  const existing = byEmail.get(email);
  if (existing) return existing;
  const created = {
    canonicalEmail: email,
    altEmails: [],
    names: [name],
    operation: "CREATE",
    category: "APP",
    reason: `application-source:${sourceSystem}`,
    pipelineStages: [],
    pipelinePrograms: [],
    waitlist: { LE: false, GYU: false },
    acuity: { total: 0, current: 0, legacy: 0, attach: false },
    stripe: { customer: null },
    matchedApplications: [],
    structuredAcuityAppointments: [],
    waitlistJoinedAt: {},
    hasApplication: true,
    notionCallDate: null,
    acuityEarliestCallDate: null,
  };
  people.push(created);
  byEmail.set(email, created);
  return created;
}

// --- GYU applications (original form) --------------------------------------
const janIntent = new Set(
  rulings.gyuJanuaryReconciliation.januaryIntentApplicantEmails_originalGyuForm,
);
for (const row of gyuApp.rows) {
  const email = normEmail(row.email);
  const person = ensurePerson(email, row.name, "notion_gyu_app");
  person.matchedApplications.push({
    sourceUrl: row.url,
    program: "GYU",
    status: row.status,
    submittedAt: row.submitted_at,
    rawFields: {},
    intendedCohortName: janIntent.has(email)
      ? "Growing Yourself Up — January 2027"
      : null,
  });
}

// --- GYU applications (January-specific form: genuine submissions only) -----
for (const row of janFormApp.rows) {
  if (isJanuaryDatabaseConstructionArtifact(row.createdTime)) continue;
  const email = normEmail(row.email);
  const person = ensurePerson(email, row.name, "notion_jan_form_gyu_app");
  person.matchedApplications.push({
    sourceUrl: row.url,
    program: "GYU",
    status: row.status,
    submittedAt: row.submitted_at,
    rawFields: {},
    intendedCohortName: "Growing Yourself Up — January 2027",
  });
}

// --- LE applications --------------------------------------------------------
const noiseIds = new Set(
  rulings.gyuJanuaryReconciliation.leSourceNoiseExcludedPageIds,
);
const dax = rulings.gyuJanuaryReconciliation.daxKaraRetryCollapse;
const linkByAppPageId = new Map();
for (const link of pipelineLeLinks.rows) {
  const id = pageId(link.leApplicationUrl);
  if (id) linkByAppPageId.set(id, link.email ? normEmail(link.email) : null);
}
for (const row of leApp.rows) {
  const id = pageId(row.url);
  if (noiseIds.has(id) || id === dax.duplicateProvenancePageId) continue;
  let email = normEmail(row.email);
  const correction =
    rulings.gyuJanuaryReconciliation.identityEmailCorrections[id];
  if (correction) email = normEmail(correction.correctedValue);
  const person = ensurePerson(email, row.name, "notion_le_questionnaire");
  person.matchedApplications.push({
    sourceUrl: row.url,
    program: "LE",
    status: row.status,
    submittedAt: row.submitted_at,
    rawFields: {},
    intendedCohortName: null,
  });
}
for (const row of leAppNoEmail.rows) {
  const id = pageId(row.url);
  if (noiseIds.has(id)) continue;
  const linkedEmail = linkByAppPageId.get(id);
  const person =
    linkedEmail && byEmail.has(linkedEmail)
      ? byEmail.get(linkedEmail)
      : ensurePerson(
          `le-standalone:${id}`,
          row.name,
          "notion_le_questionnaire_noemail",
        );
  person.matchedApplications.push({
    sourceUrl: row.url,
    program: "LE",
    status: row.status,
    submittedAt: row.submitted_at,
    rawFields: {},
    intendedCohortName: null,
  });
}

// --- Acuity: structured (current-type) appointments per person --------------
// The three current-Offer appointment types (two sales-call types + the
// LE client-session type) — every other type is legacy/descriptive-only.
const CURRENT_TYPES = new Set(["91345095", "64654501", "90522599"]);
for (const appt of acuityAppts) {
  let person = null;
  for (const c of splitEmails(appt.email)) {
    if (byEmail.has(c)) {
      person = byEmail.get(c);
      break;
    }
  }
  if (!person) continue;
  if (!person.acuity?.attach) continue;
  if (!CURRENT_TYPES.has(String(appt.appointmentTypeID))) continue;
  person.structuredAcuityAppointments.push({
    id: String(appt.id),
    appointmentTypeID: appt.appointmentTypeID,
    datetime: appt.datetime,
  });
}

// --- LE waitlist: joined_at / priority / confidence caveat -----------------
// The LE source has NO join date for anyone (Date Joined empty on all 37
// rows), so joined_at takes the one real source timestamp that exists —
// the page's own createdTime — and `notes` says plainly that this is a
// data-entry time, not a confirmed join date. The 21 rows carrying an
// Applied Order share a single bulk-import createdTime; the other 16 have
// individual createdTimes and no order at all, so priority stays NULL for
// them rather than inventing a rank. Never now(), never migration time.
const leWaitlistConf = rulings.leWaitlistOrderConfidence;
for (const row of leWaitlist.rows) {
  const person = byEmail.get(normEmail(row.email));
  if (!person) continue;
  person.waitlistJoinedAt.LE = row.createdTime;
  person.waitlistPriority = person.waitlistPriority ?? {};
  person.waitlistNotes = person.waitlistNotes ?? {};
  person.waitlistPriority.LE = row.appliedOrder ?? null;
  person.waitlistNotes.LE =
    row.appliedOrder != null
      ? `Historical import: waitlist order ${row.appliedOrder} of ${leWaitlistConf.confirmedOrderCount} is source-confirmed (${leWaitlistConf.confirmedOrderSource}). joined_at is the source page creation time, NOT a confirmed join date — the source records no join date for anyone on this waitlist.`
      : "Historical import: no waitlist order recorded in the source, so priority is intentionally empty rather than inferred. joined_at is the source page creation time, NOT a confirmed join date.";
}

// --- January GYU waitlist join dates ---------------------------------------
const janDupPageIds = new Set(
  rulings.januaryGyuWaitlistDuplicatePairs.map((d) => d.duplicatePageId),
);
for (const row of janWaitlist.rows) {
  if (janDupPageIds.has(pageId(row.url))) continue;
  const person = byEmail.get(normEmail(row.email));
  if (person) person.waitlistJoinedAt.GYU = row.dateJoined;
}

// ---------------------------------------------------------------------------
// Run the REAL orchestrator for every person.
// ---------------------------------------------------------------------------
const nextIdByTable = JSON.parse(fs.readFileSync(nextIdsFile, "utf8"));
// Cohort ids read live from the target database — the writer resolves
// intended_cohort_id by NAME and fails closed when absent, so this has to
// be the real target state rather than a hardcoded guess.
const cohortIdByName = new Map(
  JSON.parse(
    fs.readFileSync(path.join(DATA, "target_cohorts.json"), "utf8"),
  ).map((c) => [c.name, c.id]),
);
let priorState = {
  ledger: new Map(),
  contactsByEmail: new Map(),
  cohortIdByName,
};
if (priorStateFile) {
  const raw = JSON.parse(fs.readFileSync(priorStateFile, "utf8"));
  priorState = {
    ledger: new Map(Object.entries(raw.ledger)),
    contactsByEmail: new Map(Object.entries(raw.contactsByEmail)),
    cohortIdByName,
  };
}

// The target database's CURRENT rows (baseline + anything a prior pass
// committed), so every check-then-insert guard in the writer is answered
// from reality. Assuming "empty" here is what produced the duplicate
// acuity_appointment_id Postgres rejected, and would have silently
// duplicated Contacts, which carry no unique email index.
const targetState = JSON.parse(fs.readFileSync(targetStateFile, "utf8"));
// Committed facts the rulings-driven pass below must consult, so that a
// rerun reaches the same decisions as the first pass rather than
// re-creating what is already there.
const ledgerIndex = new Map(
  (targetState.ledger ?? []).map((l) => [`${l.t}:${l.k}`, l.e]),
);
const enrollmentByDealId = new Set(
  (targetState.enrollmentsByDeal ?? []).map((e) => String(e.d)),
);

const client = makeShimClient(nextIdByTable, priorState, targetState);
const batchId = "gate-a-full-volume-2026-09-16";
const tally = {
  contacts: 0,
  deals: 0,
  applications: 0,
  waitlistEntries: 0,
  enrollments: 0,
  salesCalls: 0,
  clientSessions: 0,
  skipped: 0,
};

const contactIdByEmail = new Map();
const dealIdByEmail = new Map();
const enrollmentIdByEmail = new Map();
for (const person of people) {
  const r = await importPerson(client, person, rulings, { batchId });
  if (r.contactId != null)
    contactIdByEmail.set(person.canonicalEmail, r.contactId);
  if (r.dealId != null) dealIdByEmail.set(person.canonicalEmail, r.dealId);
  if (r.enrollmentId != null)
    enrollmentIdByEmail.set(person.canonicalEmail, r.enrollmentId);
  if (!r.calledWriters.length) {
    tally.skipped++;
    continue;
  }
  for (const w of r.calledWriters) {
    if (w === "upsertHistoricalContact") tally.contacts++;
    else if (w === "insertHistoricalDeal") tally.deals++;
    else if (w === "insertHistoricalApplication") tally.applications++;
    else if (w.startsWith("insertHistoricalWaitlistEntry"))
      tally.waitlistEntries++;
    else if (w === "insertHistoricalEnrollment") tally.enrollments++;
    else if (w === "insertHistoricalSalesCall") tally.salesCalls++;
    else if (w === "insertHistoricalClientSession") tally.clientSessions++;
  }
}

// --- Rulings-driven Fall enrollment additions ------------------------------
// Explicit human rulings, not derivable from the Pipeline/Application
// sources — written through the SAME writers, never a special-cased SQL path.
for (const [email, ruling] of Object.entries(
  rulings.gyuJanuaryReconciliation.fallEnrollmentAdditions ?? {},
)) {
  const person = byEmail.get(email);
  if (!person)
    throw new Error(
      `fallEnrollmentAdditions: no canonical person for ${email}`,
    );
  const when = person.acuityEarliestCallDate ?? person.notionCallDate;
  if (!when)
    throw new Error(
      `fallEnrollmentAdditions: no real date evidence for ${email}`,
    );
  // The Contact id comes from this same batch run (importPerson returned
  // it) or, on a rerun, from the committed provenance ledger — never a
  // guess, and never a second lookup path that could disagree.
  const contactId =
    contactIdByEmail.get(email) ??
    priorState.ledger.get(`contacts:phase3-2026:${email}`)?.entityId ??
    null;
  if (contactId == null)
    throw new Error(
      `fallEnrollmentAdditions: no Contact id resolved for ${email}`,
    );

  // Anyone in this ruling who ALSO has a Pipeline record already got their
  // single Deal in the main pass, resolved with the ruling's own offer and
  // stage (resolveDealOfferId / resolveDealStage give the ruling top
  // precedence). Creating another Deal here would duplicate them — which
  // it did, for the two of the three who have Pipeline records. Only the
  // person with no Pipeline presence at all needs a Deal created.
  // On a rerun importPerson short-circuits at "already-imported" and
  // returns dealId: null, so the in-run map is empty. Fall back to the
  // COMMITTED provenance ledger — persistent facts, not per-run state —
  // or this block creates a second Deal on every subsequent pass.
  let dealId =
    dealIdByEmail.get(email) ??
    [
      `phase3-2026:${email}:deal`,
      `phase3-2026:${email}:deal:GYU`,
      `phase3-2026:${email}:deal:LE`,
      `ruling-fall-addition:${email}:deal`,
    ]
      .map((k) => ledgerIndex.get(`deals:${k}`))
      .find((v) => v != null) ??
    null;
  if (dealId == null) {
    const dealResult = await insertHistoricalDeal(client, {
      sourceKey: `ruling-fall-addition:${email}:deal`,
      sourceSystem: "existing_crm",
      batchId,
      contactId,
      offerId: ruling.cohortOfferId,
      stage: ruling.dealStage,
      outcome: null,
      name: ruling.name,
      createdAt: when,
      updatedAt: when,
      stageEnteredAt: when,
      stageEnteredAtEvidence: "APPROXIMATE_SOURCE_TIMESTAMP",
      cohortId: null,
    });
    if (dealResult.operation === "create") tally.deals++;
    dealId = dealResult.dealId;
  }

  // The enrollment is the substance of the ruling ("signed up, onboarded,
  // payment plan set up"), so it attaches to whichever Deal the person
  // actually has — but only when the main pass did not already create one
  // for them. enrollments.opportunity_id is unique and the writer rightly
  // refuses a second enrollment on a Deal that already has one, so asking
  // for one here aborts the batch rather than harmlessly no-opping.
  // Same reasoning for the enrollment: "does this Deal already have one"
  // has to be answered from committed state as well as from this run.
  const dealAlreadyEnrolled =
    enrollmentIdByEmail.get(email) != null ||
    enrollmentByDealId.has(String(dealId));
  if (!dealAlreadyEnrolled) {
    const enr = await insertHistoricalEnrollment(client, {
      sourceKey: `ruling-fall-addition:${email}:enrollment`,
      sourceSystem: "existing_crm",
      batchId,
      dealId,
      status: "active",
      startDate: null,
      endDate: null,
    });
    if (enr.operation === "create") tally.enrollments++;
  }
}

const body = [
  "begin;",
  "select set_historical_migration_mode(true);",
  ...client.statements,
  "select set_historical_migration_mode(false);",
  "commit;",
].join("\n");
fs.writeFileSync(outFile, body);

// eslint-disable-next-line no-console
console.log(
  JSON.stringify(
    {
      peopleConsidered: people.length,
      statementCount: client.statements.length,
      tally,
    },
    null,
    2,
  ),
);
