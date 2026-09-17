// Historical Migration slice — the ONE deterministic generator pass.
// Loads real source data + rulings from ./data/ (all gitignored) and
// mechanically derives the complete historical migration manifest: every
// planned Contact/Application/Deal/WaitlistEntry/Enrollment/event/
// provenance row. Pure functions only below `main()` — no hardcoded real
// data, no hand-edited output. Run twice (`node generateManifest.mjs` /
// compare against a second run) to prove reproducibility; see
// reproducibility-check.mjs.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  planPerson,
  summarizePlan,
  applyIdentitySplitRulings,
  OFFER_ID_BY_PROGRAM,
  SALES_CALL_TYPE_IDS,
  CLIENT_SESSION_TYPE_TO_OFFER,
} from "./plan.mjs";
import { isJanuaryDatabaseConstructionArtifact } from "./applicationMapping.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const normEmail = (e) => (e || "").trim().toLowerCase().replace(/\s+/g, "");
const splitEmails = (raw) =>
  (raw || "").split(",").map(normEmail).filter(Boolean);

/**
 * Load every real source file this generator consumes. Throws with a clear
 * message naming the missing file rather than silently proceeding on
 * partial data — a missing source must never quietly produce a smaller,
 * wrong manifest.
 */
export function loadSources() {
  const required = [
    "phase3_staging_reproduced.json",
    "rulings.json",
    "notion_le_questionnaire.json",
    "notion_le_questionnaire_noemail.json",
    "pipeline_le_application_links.json",
    "notion_gyu_app.json",
    "notion_jan_gyu_waitlist.json",
    "notion_jan_form_gyu_app.json",
    "notion_le_waitlist.json",
  ];
  for (const f of required) {
    if (!fs.existsSync(path.join(DATA_DIR, f))) {
      throw new Error(
        `generateManifest: missing required source file data/${f} — cannot proceed on partial data`,
      );
    }
  }
  return {
    staging: readJSON(path.join(DATA_DIR, "phase3_staging_reproduced.json")),
    rulings: readJSON(path.join(DATA_DIR, "rulings.json")),
    leApp: readJSON(path.join(DATA_DIR, "notion_le_questionnaire.json")),
    leAppNoEmail: readJSON(
      path.join(DATA_DIR, "notion_le_questionnaire_noemail.json"),
    ),
    pipelineLeLinks: readJSON(
      path.join(DATA_DIR, "pipeline_le_application_links.json"),
    ),
    gyuApp: readJSON(path.join(DATA_DIR, "notion_gyu_app.json")),
    janWaitlist: readJSON(path.join(DATA_DIR, "notion_jan_gyu_waitlist.json")),
    janFormApp: readJSON(path.join(DATA_DIR, "notion_jan_form_gyu_app.json")),
    leWaitlist: readJSON(path.join(DATA_DIR, "notion_le_waitlist.json")),
  };
}

/**
 * Build the email -> person lookup used throughout, from the frozen
 * staging manifest's 295-person reproduced baseline.
 */
function buildEmailIndex(records) {
  const index = new Map();
  for (const p of records) {
    const emails = new Set([
      ...splitEmails(p.canonicalEmail),
      ...(p.altEmails || []).flatMap(splitEmails),
      ...(p.excludedTypoEmails || []).flatMap(splitEmails),
    ]);
    for (const e of emails) index.set(e, p);
  }
  return index;
}

/**
 * GYU Applications: exclude the 56 January-database construction
 * artifacts (mechanical createdTime match, never name/email), collapse
 * nothing (GYU has zero duplicate submissions per source truth), attach
 * each genuine row to a canonical person (existing, from the 295 baseline,
 * or newly-deterministic if unmatched-but-legitimate), and stamp
 * offer/intended-cohort from the rulings' Fall/January-intent lists.
 */
function planGyuApplications(gyuApp, rulings, emailIndex) {
  const januaryIntentOriginal = new Set(
    rulings.gyuJanuaryReconciliation.januaryIntentApplicantEmails_originalGyuForm,
  );
  const applications = [];
  const newContacts = [];
  for (const row of gyuApp.rows) {
    const email = normEmail(row.email);
    const intendedCohortName = januaryIntentOriginal.has(email)
      ? "Growing Yourself Up — January 2027"
      : null;
    let person = emailIndex.get(email);
    if (!person) {
      // Deterministically legitimate new person (Phase 4H finding: 36
      // GYU-outside-Pipeline applicants, zero test/artifact emails among
      // them) — Contact + Application only, no Deal fabricated.
      person = { canonicalEmail: email, names: [row.name], _new: true };
      newContacts.push(person);
      emailIndex.set(email, person);
    }
    applications.push({
      sourceUrl: row.url,
      program: "GYU",
      offerId: OFFER_ID_BY_PROGRAM.GYU,
      intendedCohortName,
      status: row.status,
      submittedAt: row.submitted_at,
      canonicalEmail: person.canonicalEmail,
      provenanceSourceUrls: [row.url],
    });
  }
  return { applications, newContacts };
}

/**
 * January-form GYU Applications: exactly one genuine row survives the
 * mechanical createdTime exclusion rule — every other row in this
 * database is a construction artifact and contributes nothing.
 */
function planJanuaryFormGyuApplications(janForm, emailIndex) {
  const applications = [];
  const newContacts = [];
  for (const row of janForm ?? []) {
    if (isJanuaryDatabaseConstructionArtifact(row.createdTime)) continue;
    const email = normEmail(row.email);
    let person = emailIndex.get(email);
    if (!person) {
      person = { canonicalEmail: email, names: [row.name], _new: true };
      newContacts.push(person);
      emailIndex.set(email, person);
    }
    applications.push({
      sourceUrl: row.url,
      program: "GYU",
      offerId: OFFER_ID_BY_PROGRAM.GYU,
      intendedCohortName: "Growing Yourself Up — January 2027",
      status: row.status,
      submittedAt: row.submitted_at,
      canonicalEmail: person.canonicalEmail,
      provenanceSourceUrls: [row.url],
    });
  }
  return { applications, newContacts };
}

/**
 * LE Applications — COMPLETE: email-bearing rows + the two
 * no-email populations (relation-resolved to an existing Pipeline
 * Contact, or genuinely standalone — each becomes its own new Contact
 * from the Application record alone, NEVER merged with anyone by name).
 * An email-bearing row whose applicant is absent from the Pipeline
 * likewise yields a new Contact: never triaged is not the same as never
 * existed, and their Application (often still `Pending`) is a live
 * obligation that must land in the review queue.
 * Excludes the one source-noise row; collapses the one applicant's two
 * retry submissions into a single canonical Application carrying both
 * provenance source URLs (see daxKaraRetryCollapse in rulings.json).
 */
function planLeApplications(
  leApp,
  leAppNoEmail,
  pipelineLeLinks,
  rulings,
  emailIndex,
) {
  const noiseIds = new Set(
    rulings.gyuJanuaryReconciliation.leSourceNoiseExcludedPageIds,
  );
  const dax = rulings.gyuJanuaryReconciliation.daxKaraRetryCollapse;
  const pageId = (url) => (url.match(/([0-9a-f]{32})/i) || [])[1];

  // Pipeline's own "1:1 Application" relation, keyed by the LINKED
  // application page id -> the Pipeline person's own (resolved) email.
  const linkByAppPageId = new Map();
  for (const link of pipelineLeLinks.rows) {
    const id = pageId(link.leApplicationUrl);
    if (id) linkByAppPageId.set(id, link.email ? normEmail(link.email) : null);
  }

  const applications = [];
  const newContacts = [];
  const seenCanonicalKeys = new Set();

  // Pass 1: email-bearing rows (includes both retry submissions).
  for (const row of leApp.rows) {
    const id = pageId(row.url);
    if (noiseIds.has(id)) continue;
    if (id === dax.duplicateProvenancePageId) continue;
    let email = normEmail(row.email);
    const correction =
      rulings.gyuJanuaryReconciliation.identityEmailCorrections[id];
    const originalMalformedEmail = correction ? correction.originalValue : null;
    if (correction) email = normEmail(correction.correctedValue);
    const canonicalKey = id === dax.canonicalPageId ? "dax" : id;
    if (seenCanonicalKeys.has(canonicalKey)) continue;
    seenCanonicalKeys.add(canonicalKey);
    const provenanceSourceUrls =
      id === dax.canonicalPageId
        ? [row.url, `https://app.notion.com/${dax.duplicateProvenancePageId}`]
        : [row.url];
    applications.push({
      sourceUrl: row.url,
      program: "LE",
      offerId: OFFER_ID_BY_PROGRAM.LE,
      intendedCohortName: null,
      status: row.status,
      submittedAt: row.submitted_at,
      canonicalEmail: email,
      originalMalformedEmail,
      provenanceSourceUrls,
      resolution: "email",
    });
    // A real person, with a real email, who really submitted an LE
    // application but was never triaged into the Pipeline. The Application
    // is only meaningful attached to a Contact, so the Contact is created
    // from the Application record alone — the same rule Pass 2 already
    // applies to the no-email standalone rows, here with STRONGER
    // evidence (a real email rather than a name only). Without this the
    // manifest promises an Application whose Contact nobody creates.
    if (!emailIndex.has(email)) {
      const created = { canonicalEmail: email, names: [row.name], _new: true };
      emailIndex.set(email, created);
      newContacts.push(created);
    }
  }

  // Pass 2: no-email rows — resolved via Pipeline's direct relation link
  // (deterministic, never name-matched) or genuinely standalone.
  for (const row of leAppNoEmail.rows) {
    const id = pageId(row.url);
    if (noiseIds.has(id)) continue; // the source-noise row lives in this file
    if (seenCanonicalKeys.has(id)) continue;
    seenCanonicalKeys.add(id);
    const linkedEmail = linkByAppPageId.get(id);
    if (linkedEmail && emailIndex.has(linkedEmail)) {
      applications.push({
        sourceUrl: row.url,
        program: "LE",
        offerId: OFFER_ID_BY_PROGRAM.LE,
        intendedCohortName: null,
        status: row.status,
        submittedAt: row.submitted_at,
        canonicalEmail: linkedEmail,
        provenanceSourceUrls: [row.url],
        resolution: "pipeline-relation",
      });
    } else {
      // Standalone: a real historical fact (someone named X applied on
      // date Y) preserved as its own Contact — never merged by name with
      // any other record, per the established identity rule.
      const syntheticKey = `le-standalone:${id}`;
      applications.push({
        sourceUrl: row.url,
        program: "LE",
        offerId: OFFER_ID_BY_PROGRAM.LE,
        intendedCohortName: null,
        status: row.status,
        submittedAt: row.submitted_at,
        canonicalEmail: syntheticKey,
        applicantNameOnly: row.name,
        provenanceSourceUrls: [row.url],
        resolution: "standalone-new-contact",
      });
      newContacts.push({
        canonicalEmail: syntheticKey,
        names: [row.name],
        _new: true,
        _nameOnly: true,
      });
    }
  }

  return { applications, newContacts };
}

/**
 * January GYU waitlist: collapse the 3 exact-email re-import duplicate
 * pairs to one canonical entry each (both page ids preserved as
 * provenance), never merging the two different-email records that a
 * do-not-merge ruling covers.
 */
function planJanuaryWaitlist(janWaitlist, rulings) {
  const dupPairs = rulings.januaryGyuWaitlistDuplicatePairs;
  const dupPageIds = new Set(dupPairs.map((d) => d.duplicatePageId));
  const entries = [];
  const seen = new Set();
  for (const row of janWaitlist.rows) {
    const pageId = (row.url.match(/([0-9a-f]{32})/i) || [])[1];
    if (dupPageIds.has(pageId)) continue;
    const email = normEmail(row.email);
    if (seen.has(email)) continue; // defensive; source truth says 0 genuine second-signups beyond the 3 known pairs
    seen.add(email);
    const dup = dupPairs.find((d) => d.canonicalEmail === email);
    entries.push({
      canonicalEmail: email,
      offerId: OFFER_ID_BY_PROGRAM.GYU,
      intendedCohortName: "Growing Yourself Up — January 2027",
      joinedAtDate: row.dateJoined,
      dateGranularity: "day",
      provenanceSourceUrls: dup
        ? [row.url, `https://app.notion.com/${dup.duplicatePageId}`]
        : [row.url],
    });
  }
  return entries;
}

/**
 * Deals + Enrollments: reuses plan.mjs's own summarizePlan (already
 * tested, Phase 4A-4C code) against the reproduced 295-person baseline,
 * PLUS the explicit Fall-2026 enrollment additions this round
 * establishes (see fallEnrollmentAdditions in rulings.json).
 */
function planDealsAndEnrollments(records, rulings) {
  const base = summarizePlan(records, rulings);
  const additions = rulings.gyuJanuaryReconciliation.fallEnrollmentAdditions;
  const withdrawn = rulings.gyuJanuaryReconciliation.fallWithdrawn;
  const excludedPendingIdentification = [];
  const samRuling =
    rulings.gyuJanuaryReconciliation.samMilzNoFabricatedApplication;
  if (samRuling?.excludedFromGenerator) {
    // Label comes from the (gitignored) ruling itself — never a real
    // client name hardcoded into tracked source.
    excludedPendingIdentification.push(
      samRuling.reason ?? "excluded pending identification (see rulings.json)",
    );
  }
  const additionCount = Object.keys(additions).length;

  // The SKIP->CREATE rescue for rulings-named people now lives in the
  // planner itself (plan.mjs resolveContactOperation), so summarizePlan
  // already reports the real operation — no manifest-layer patch, and no
  // way for the manifest and the writer to disagree.
  const contactsOverride = { ...base.contacts };

  // Fall additions are always GYU (offerId 2) — encoded directly in their
  // own ruling entries (cohortOfferId), never assumed.
  //
  // A Fall-enrollment ruling GOVERNS the person's own Deal rather than
  // adding a second one beside it: resolveDealOfferId / resolveDealStage
  // give the ruling top precedence, so anyone in this ruling who also has
  // a Pipeline record is ALREADY counted in `base` with the ruling's offer
  // and stage. Only someone with no Deal of their own needs one created.
  // Counting all of them here promised three more Deals (and enrollments)
  // than the writer produces.
  const additionsNeedingNewDeal = Object.keys(additions).filter((email) => {
    const person = records.find((r) => r.canonicalEmail === email);
    if (!person) return true;
    const planned = planPerson(person, rulings);
    return !(planned.dealPlan || planned.dualDealPlans?.length);
  });
  const newAdditionCount = additionsNeedingNewDeal.length;

  // Needing an ENROLLMENT is a separate question from needing a Deal. The
  // substance of these rulings is that the person is enrolled ("signed up,
  // onboarded, payment plan set up"), so someone who already has a Deal
  // but whose planned path produced no enrollment still gains one, on that
  // existing Deal.
  const additionsNeedingEnrollment = Object.keys(additions).filter((email) => {
    const person = records.find((r) => r.canonicalEmail === email);
    if (!person) return true;
    return !planPerson(person, rulings).enrollmentPlan;
  }).length;
  const additionsGyuCount = additionsNeedingNewDeal.filter(
    (e) => additions[e].cohortOfferId === 2,
  ).length;
  const additionsLeCount = newAdditionCount - additionsGyuCount;

  return {
    contactsOverride,
    additionCount,
    additionsNeedingNewDeal: newAdditionCount,
    dealsCreate: base.deals.create + newAdditionCount,
    dealsLeOffer: base.deals.leOffer + additionsLeCount,
    dealsGyuOffer: base.deals.gyuOffer + additionsGyuCount,
    dealsPcCommittedNurture: base.deals.pcCommittedNurture,
    dealsCcStructured: base.deals.ccStructured + newAdditionCount,
    dealOfferIssues: base.offerIssues,
    additionsNeedingEnrollment,
    enrollmentsCreate: base.enrollments.create + additionsNeedingEnrollment,
    enrollmentsActive: base.enrollments.active + additionsNeedingEnrollment, // the Fall 2026 additions are ONGOING (cohort starts 2026-09-22), not completed
    enrollmentsCompleted: base.enrollments.completed,
    enrollmentsWithdrawnCount: Object.keys(withdrawn).length, // a historical withdrawal is preserved as BOTH an enrolled event and a withdrawal, not a live active enrollment
    excludedPendingIdentification,
    baseSummary: base,
  };
}

/**
 * Acuity: re-run the deterministic appointment/identity association
 * against the raw 607-row pull and the (email-index-extended) canonical
 * population. Program-generic — takes acuityAppts + emailIndex, no
 * hardcoded numbers.
 */
export function planAcuity(acuityAppts, records, emailIndex) {
  const SALES_CALL_TYPES = new Set([...SALES_CALL_TYPE_IDS].map(String));
  const CLIENT_SESSION_TYPES = new Set(
    Object.keys(CLIENT_SESSION_TYPE_TO_OFFER),
  );
  let salesCalls = 0,
    clientSessions = 0,
    legacyDescriptive = 0,
    excluded = 0,
    unattributable = 0;
  for (const a of acuityAppts) {
    const candidates = splitEmails(a.email);
    let person = null;
    for (const c of candidates) {
      if (emailIndex.has(c)) {
        person = emailIndex.get(c);
        break;
      }
    }
    if (!person) {
      unattributable++;
      continue;
    }
    if (person.acuity && person.acuity.attach) {
      const t = String(a.appointmentTypeID);
      if (SALES_CALL_TYPES.has(t)) salesCalls++;
      else if (CLIENT_SESSION_TYPES.has(t)) clientSessions++;
      else legacyDescriptive++;
    } else {
      excluded++;
    }
  }
  return {
    salesCalls,
    clientSessions,
    legacyDescriptive,
    excluded,
    unattributable,
    total:
      salesCalls +
      clientSessions +
      legacyDescriptive +
      excluded +
      unattributable,
  };
}

export function generateManifest() {
  const {
    staging,
    rulings,
    leApp,
    leAppNoEmail,
    pipelineLeLinks,
    gyuApp,
    janWaitlist,
    janFormApp,
    leWaitlist,
  } = loadSources();
  // Rulings outrank the staging manifest's own identity decisions, so any
  // merge a ruling forbids is undone BEFORE anything is counted or planned.
  const records = applyIdentitySplitRulings(staging.records, rulings);
  const emailIndex = buildEmailIndex(records);

  const { applications: gyuApps, newContacts: gyuNewContacts } =
    planGyuApplications(gyuApp, rulings, emailIndex);
  const { applications: janFormApps, newContacts: janFormNewContacts } =
    planJanuaryFormGyuApplications(janFormApp.rows, emailIndex);
  const { applications: leApps, newContacts: leNewContacts } =
    planLeApplications(
      leApp,
      leAppNoEmail,
      pipelineLeLinks,
      rulings,
      emailIndex,
    );
  const janWaitlistEntries = planJanuaryWaitlist(janWaitlist, rulings);

  // Attach each planned Application to the person it belongs to BEFORE the
  // contact operations are counted. resolveContactOperation treats a
  // submitted Application as a reason to exist in the CRM, so the manifest
  // has to see the same signal the writer sees — otherwise the two
  // disagree about who gets created, which is exactly the divergence the
  // planner-owned resolveContactOperation exists to prevent.
  for (const app of [...gyuApps, ...janFormApps, ...leApps]) {
    const person = emailIndex.get(app.canonicalEmail);
    if (!person) continue;
    (person.matchedApplications ??= []).push(app);
  }

  const dealsEnrollments = planDealsAndEnrollments(records, rulings);

  // Waitlist counts are DERIVED from the sources and cross-checked against
  // each other. A hardcoded count here is exactly how a real membership
  // went missing without the manifest noticing: the manifest claimed the
  // canonical January figure while the writer emitted one fewer, and the
  // row-count reconciliation compared the writer against itself.
  const waitlistCounts = {
    leSourceRows: leWaitlist.rows.length,
    leCount: records.filter((p) => p.waitlist?.LE).length,
    januaryGyuSourceRows: janWaitlist.rows.length,
    januaryGyuDuplicatePairsCollapsed:
      rulings.januaryGyuWaitlistDuplicatePairs.length,
    januaryGyuCanonicalCount: janWaitlistEntries.length,
    januaryGyuMembershipsWritten: records.filter((p) => p.waitlist?.GYU).length,
    plannedWaitlistRowsTotal: dealsEnrollments.baseSummary.waitlistEntryRows,
  };
  const expectedJanuary =
    waitlistCounts.januaryGyuSourceRows -
    waitlistCounts.januaryGyuDuplicatePairsCollapsed;
  if (waitlistCounts.januaryGyuCanonicalCount !== expectedJanuary) {
    throw new Error(
      `January GYU waitlist drift: ${waitlistCounts.januaryGyuSourceRows} source rows minus ${waitlistCounts.januaryGyuDuplicatePairsCollapsed} collapsed duplicate pairs should be ${expectedJanuary}, got ${waitlistCounts.januaryGyuCanonicalCount}.`,
    );
  }
  // Every canonical membership must become a row someone actually owns.
  // This is the check that would have caught a second January signup being
  // absorbed by a merged identity (see the do-not-merge ruling).
  if (
    waitlistCounts.januaryGyuMembershipsWritten !==
    waitlistCounts.januaryGyuCanonicalCount
  ) {
    throw new Error(
      `January GYU waitlist drift: ${waitlistCounts.januaryGyuCanonicalCount} canonical memberships but only ${waitlistCounts.januaryGyuMembershipsWritten} will be written — a membership is being absorbed by identity resolution.`,
    );
  }
  if (
    waitlistCounts.plannedWaitlistRowsTotal !==
    waitlistCounts.leCount + waitlistCounts.januaryGyuCanonicalCount
  ) {
    throw new Error(
      `Waitlist total drift: planned ${waitlistCounts.plannedWaitlistRowsTotal} rows vs ${waitlistCounts.leCount} LE + ${waitlistCounts.januaryGyuCanonicalCount} January GYU.`,
    );
  }
  const allNewContacts = [
    ...gyuNewContacts,
    ...janFormNewContacts,
    ...leNewContacts,
  ];

  const contacts = {
    ...dealsEnrollments.contactsOverride,
    deterministicNewFromApplications: allNewContacts.length,
    newFromApplicationsBySource: {
      gyuOriginalForm: gyuNewContacts.length,
      gyuJanuaryForm: janFormNewContacts.length,
      leApplicationOnly: leNewContacts.length,
    },
    total: records.length + allNewContacts.length,
  };

  const applications = {
    gyuOriginalForm: gyuApps.length,
    gyuJanuaryForm: janFormApps.length,
    gyuTotal: gyuApps.length + janFormApps.length,
    gyuFallIntent: gyuApps.filter((a) => !a.intendedCohortName).length,
    gyuJanuaryIntent:
      gyuApps.filter((a) => a.intendedCohortName).length + janFormApps.length,
    leTotal: leApps.length,
    leByResolution: {
      email: leApps.filter((a) => a.resolution === "email").length,
      pipelineRelation: leApps.filter(
        (a) => a.resolution === "pipeline-relation",
      ).length,
      standaloneNewContact: leApps.filter(
        (a) => a.resolution === "standalone-new-contact",
      ).length,
    },
    canonicalTotal: gyuApps.length + janFormApps.length + leApps.length,
  };

  const provenanceRows =
    // Each canonical Application: exactly 1 historical_import_records row
    // (keyed by its own sourceKey — see write.mjs's recordProvenance,
    // called once per canonical object, not once per source record; Dax's
    // 2nd source page is carried as extra data on the SAME canonical row,
    // not a second provenance row).
    applications.canonicalTotal +
    dealsEnrollments.dealsCreate +
    dealsEnrollments.enrollmentsCreate +
    janWaitlistEntries.length +
    dealsEnrollments.baseSummary.waitlistEntryRows; // LE + original-source GYU waitlist rows already counted by summarizePlan

  return {
    generatedAt: "NORMALIZED_FOR_COMPARISON",
    contacts,
    applications,
    deals: {
      create: dealsEnrollments.dealsCreate,
      leOffer: dealsEnrollments.dealsLeOffer,
      gyuOffer: dealsEnrollments.dealsGyuOffer,
      pcCommittedNurture: dealsEnrollments.dealsPcCommittedNurture,
      ccStructured: dealsEnrollments.dealsCcStructured,
      offerIssues: dealsEnrollments.dealOfferIssues,
      // The rulings-based Fall additions are all
      // dealStage='won' (see rulings.json) and carry no outcome — added
      // here explicitly so byStage/byOutcome sum to the same `create`
      // total as leOffer+gyuOffer does, rather than silently omitting them.
      byStage: {
        ...dealsEnrollments.baseSummary.deals.byStage,
        won:
          (dealsEnrollments.baseSummary.deals.byStage.won ?? 0) +
          dealsEnrollments.additionsNeedingNewDeal,
      },
      byOutcome: {
        ...dealsEnrollments.baseSummary.deals.byOutcome,
        none:
          (dealsEnrollments.baseSummary.deals.byOutcome.none ?? 0) +
          dealsEnrollments.additionsNeedingNewDeal,
      },
    },
    waitlistEntries: waitlistCounts,
    enrollments: {
      create: dealsEnrollments.enrollmentsCreate,
      active: dealsEnrollments.enrollmentsActive,
      completed: dealsEnrollments.enrollmentsCompleted,
      historicallyWithdrawn: dealsEnrollments.enrollmentsWithdrawnCount,
    },
    // Distinct, non-interchangeable numbers, reported separately so
    // "expected" compares to actual rows without any arithmetic in between:
    //   plannedFromSources  - stage events the sources actually evidence
    //   explicitRowsWritten - what the writer INSERTs (the last planned
    //                         event per Deal is left to the trigger)
    //   triggerRowsWritten  - record_deal_stage_event() fires once per Deal
    //                         insert. It is intentionally NOT migration-mode
    //                         guarded, because it copies the Deal's own
    //                         stage_entered_at rather than stamping now().
    //   totalRowsWritten    - what deal_stage_events actually gains
    events: {
      plannedFromSources: dealsEnrollments.baseSummary.events.dealStageEvents,
      explicitRowsWritten:
        dealsEnrollments.baseSummary.events.dealStageEventsExplicitRows,
      triggerRowsWritten: dealsEnrollments.dealsCreate,
      totalRowsWritten:
        dealsEnrollments.baseSummary.events.dealStageEventsExplicitRows +
        dealsEnrollments.dealsCreate,
      enrollmentStatusEvents:
        dealsEnrollments.baseSummary.events.enrollmentStatusEvents,
      operationalTasks: 0,
    },
    excludedPendingIdentification:
      dealsEnrollments.excludedPendingIdentification,
    provenanceRowsApprox: provenanceRows,
  };
}
