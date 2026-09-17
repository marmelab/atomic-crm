// Historical Migration slice — PURE planning logic (the "dry-run" half of
// the importer). Zero I/O, zero DB access, zero network access. Takes the
// already-reconciled Phase 3 staging manifest (computed once, outside this
// repo, during the human-reviewed identity/business-classification pass —
// see MEMORY.md's real-client-data-migration-status entry) plus the
// explicit human rulings layered on top of it, and deterministically
// produces the exact set of operations the writer half would perform.
//
// This module never re-reconciles identity or re-derives PC/CC business
// classifications — those are frozen, human-approved facts passed in as
// the `rulings` parameter (loaded by the caller from an external, gitignored
// file — see rulings.example.json and README.md — NEVER hardcoded here).
// Real client emails/names/Stripe IDs must never appear in this file or in
// its committed tests; only the loader that reads external, gitignored
// input files ever sees them.

/** @typedef {"CREATE"|"UPDATE"|"SKIP"} ContactOperation */

/**
 * @typedef {object} HistoricalRulings
 * @property {Record<string,string>} canonicalStripeCustomerOverrides
 * @property {string[]} pcEmails
 * @property {Record<string, {offerId: number, dealStage: string}>} ccRepresentable
 * @property {string[]} ccContactOnly
 */

export const PC_DEAL_STAGE = "committed";
export const PC_DEAL_OUTCOME = "nurture";

// The two Acuity appointment types this schema already resolves to a real,
// current-Offer client_session deterministically (offers.
// client_session_acuity_appointment_type_id — no ambiguity, no fabrication:
// confirmed directly against the live offers table, not assumed). Every
// other "current-type" id (Mini Deep Dive / GYU) is a sales-call type —
// sales_calls has no offer_id column at all, so it never needs this
// determination in the first place.
export const CLIENT_SESSION_TYPE_TO_OFFER = { 90522599: 1 };
export const SALES_CALL_TYPE_IDS = new Set([91345095, 64654501]);

// Confirmed directly against the live offers table (id 1 = "The Living
// Example", id 2 = "Growing Yourself Up") — an Application always knows
// which of these two it was for (Phase 4I).
export const OFFER_ID_BY_PROGRAM = { LE: 1, GYU: 2 };
export const GYU_JANUARY_2027_COHORT_NAME =
  "Growing Yourself Up — January 2027";

// Pipeline's own structured Program field maps directly — this is the
// PRIMARY, preferred Offer-resolution source (Phase 4M): a real,
// human-selected field on the source Pipeline row itself, not inferred.
const PIPELINE_PROGRAM_TO_OFFER_ID = {
  "The Living Example (1:1)": 1,
  "Growing Yourself Up (GYU)": 2,
};

/**
 * Deterministic historical Deal Offer resolution (Phase 4M — real Postgres
 * rejected every Deal this used to leave offerId null for). Precedence,
 * in order, never blended:
 *   1. Pipeline's own structured Program field, when it names exactly one
 *      Offer. "Both / Undecided" is a genuine source-recorded conflict,
 *      never picked between.
 *   2. rulings.explicitOfferOverrides[email] — computed once, mechanically,
 *      from other real source evidence (a matched canonical Application's
 *      program, or for a person with no Pipeline row at all, the actual
 *      Acuity sales-call appointment type they booked). Never guessed at
 *      call time — see rulings.json's own note on that key.
 *   3. unresolved — the caller must NOT create a Deal; this is a real gap,
 *      never silently defaulted to either Offer.
 *
 * @returns {{offerId:number}|{conflict:string}|{unresolved:true}}
 */
export function resolveDealOfferId(person, rulings) {
  // An explicit human ruling always wins outright, whether it exists
  // because there was never any Pipeline evidence to consult (PC people)
  // OR because it resolves a genuine source-level conflict (e.g. a
  // "Both / Undecided" Program value Leif has since ruled on) — checked
  // FIRST, unconditionally, never shadowed by a conflict return below.
  // A Fall-enrollment ruling GOVERNS outright — Leif's wording is explicit
  // that it overrides conflicting Pipeline text. It resolves the person's
  // single Deal here rather than adding a second one alongside the
  // Pipeline-derived Deal (which is what produced duplicate Deals for the
  // two of these people who DO have a Pipeline record).
  const fallAddition =
    rulings.gyuJanuaryReconciliation?.fallEnrollmentAdditions?.[
      person.canonicalEmail
    ];
  if (fallAddition) return { offerId: fallAddition.cohortOfferId };

  const override = rulings.explicitOfferOverrides?.[person.canonicalEmail];
  if (override) return { offerId: override.offerId };

  const programs = new Set((person.pipelinePrograms ?? []).filter(Boolean));
  if (programs.size === 1) {
    const [program] = programs;
    const offerId = PIPELINE_PROGRAM_TO_OFFER_ID[program];
    if (offerId) return { offerId };
    // A named-but-unmapped Program value (e.g. "Both / Undecided") is a
    // genuine source-recorded conflict, not a mapping bug to paper over.
    return { conflict: `pipelineProgram:${program}` };
  }
  if (programs.size > 1) {
    return { conflict: `pipelineProgram:multiple:${[...programs].join("|")}` };
  }
  const knownConflict =
    rulings.unresolvedOfferConflicts?.[person.canonicalEmail];
  if (knownConflict) return { conflict: knownConflict.reason };
  return { unresolved: true };
}

// Canonical stage progression order (Phase 4M/4N) — used to pick the
// FURTHEST-advanced stage when a person has multiple real Pipeline Stage
// entries across separate interactions; reaching a later stage once is
// never erased by later moving backward (e.g. into nurture).
const STAGE_RANK = [
  "interested",
  "application_received",
  "approved",
  "call_booked",
  "decision",
  "committed",
  "won",
];

// Direct mapping from Pipeline's own real Stage label to the canonical
// {stage, outcome} pair it actually evidences. Never invents a new stage;
// only uses the seven known canonical stages plus the four known exit
// outcomes. Deliberately conservative where the label itself doesn't prove
// more: "No-Show / Reschedule" only proves a call was booked, not that it
// happened; "Nurture"/"Not Interested"/"Lost" all map to the earliest
// stage (interested) because the label alone doesn't prove they reached
// further before exiting — outcome carries the actual exit meaning.
const PIPELINE_STAGE_TO_DEAL_STATE = {
  "Active Client": { stage: "won", outcome: null },
  "Completed / Past Client": { stage: "won", outcome: null },
  "Awaiting Payment Setup": { stage: "committed", outcome: null },
  "Call Scheduled": { stage: "call_booked", outcome: null },
  "No-Show / Reschedule": { stage: "call_booked", outcome: null },
  "Thinking It Over": { stage: "decision", outcome: null },
  "Nurture (Check Back Later)": { stage: "interested", outcome: "nurture" },
  "Not Interested": { stage: "interested", outcome: "lost" },
  "Lost / Went Cold": { stage: "interested", outcome: "lost" },
};

/**
 * Deterministic historical Deal stage/outcome resolution (Phase 4N — the
 * second real-Postgres-predictable defect after Offer: deals.stage is NOT
 * NULL and the ordinary-Pipeline branch never resolved one). Precedence:
 *   1. rulings.explicitStageOverrides[email] — an explicit human ruling,
 *      for a person whose Pipeline label alone can't truthfully resolve
 *      state (e.g. a genuine stage/outcome domain choice).
 *   2. The FURTHEST-advanced of the person's real Pipeline Stage label(s),
 *      via PIPELINE_STAGE_TO_DEAL_STATE — never blended, never invented.
 *   3. unresolved — no Deal is created; surfaced, never defaulted.
 *
 * @returns {{stage:string, outcome:string|null}|{unresolved:true, reason:string}}
 */
/**
 * Deterministic Deal timestamp resolution (Phase 4O). `deals.created_at`/
 * `updated_at` are the SAME universal `not null default now()` audit-
 * metadata pattern used on every table in this schema (confirmed: no live
 * UI/business logic anywhere reads deals.created_at) — never a business-
 * chronology field the way `stage_entered_at` is (that one has its own
 * dedicated trigger, set_deal_stage_entered_at()). Never blended: each of
 * the three gets its own resolution, not one value copy-pasted three ways.
 *
 *   createdAt:      the earliest defensible real evidence this specific
 *                    opportunity existed — person.notionCallDate (the
 *                    Notion Pipeline record's own Call Date field) first,
 *                    then acuityEarliestCallDate, then an explicit ruling
 *                    date if one exists. Never migration time.
 *   updatedAt:       = createdAt. Pure audit metadata with no independent
 *                    evidence of any LATER change — "as far as the
 *                    historical source shows, nothing touched this row
 *                    after its creation" is the truthful default; a
 *                    genuinely later event (e.g. a real Won date) should
 *                    override it, but no such per-person "last touched"
 *                    evidence exists in the reconciled sources today.
 *   stageEnteredAt:  when the Deal entered its CURRENT stage specifically.
 *                    Prefers the actual stage-transition evidence already
 *                    used for this person's own dealStageEvents (the most
 *                    recent one, matching the existing established
 *                    pattern); falls back to createdAt ONLY as a
 *                    conservative reuse of already-resolved real evidence
 *                    (never a fabricated new date) when no more specific
 *                    transition evidence exists — schema requires NOT
 *                    NULL, so "genuinely unknown" cannot be represented as
 *                    NULL here (confirmed: no exception in this schema).
 *
 * @returns {{createdAt:string,updatedAt:string,stageEnteredAt:string}|{unresolved:true}}
 */
export function resolveDealTimestamps(person, rulings, dealStageEvents, stage) {
  const explicitDate =
    rulings.explicitCreatedAtOverrides?.[person.canonicalEmail];
  const createdAt =
    explicitDate ??
    person.notionCallDate ??
    person.acuityEarliestCallDate ??
    null;
  if (!createdAt) return { unresolved: true };

  // Phase 4P: stage_entered_at is a BUSINESS-CHRONOLOGY field (the live
  // Kanban sorts Deal columns by it — deals/DealList.tsx + stages.ts), and
  // it is `not null` in the schema, so "unknown" cannot be represented as
  // NULL. Every value therefore ships with an explicit evidence class,
  // carried into historical_import_records.evidence_notes, so an
  // approximate anchor is never silently presented as an exact known
  // transition time:
  //   EXACT_STAGE_EVIDENCE         a real event for THIS stage, not proxied
  //   CREATION_IS_STAGE_ENTRY      entry stage, never demonstrably left it
  //   APPROXIMATE_SOURCE_TIMESTAMP a real source timestamp standing in for
  //                                an unknown exact transition moment
  const sourcingEvent = dealStageEvents?.at(-1) ?? null;
  let stageEnteredAt;
  let stageEnteredAtEvidence;
  if (sourcingEvent) {
    stageEnteredAt = sourcingEvent.at;
    stageEnteredAtEvidence =
      sourcingEvent.stage === stage && !sourcingEvent.approximate
        ? "EXACT_STAGE_EVIDENCE"
        : "APPROXIMATE_SOURCE_TIMESTAMP";
  } else {
    stageEnteredAt = createdAt;
    stageEnteredAtEvidence =
      stage === "interested"
        ? "CREATION_IS_STAGE_ENTRY"
        : "APPROXIMATE_SOURCE_TIMESTAMP";
  }
  return {
    createdAt,
    updatedAt: createdAt,
    stageEnteredAt,
    stageEnteredAtEvidence,
  };
}

export function resolveDealStage(person, rulings) {
  // Leif's Fall-enrollment ruling governs the stage over any conflicting
  // Pipeline label (his note on Mel says so in as many words). The
  // contradicting source text is preserved as provenance by the writer,
  // never erased — it just does not decide the stage.
  const fallAddition =
    rulings.gyuJanuaryReconciliation?.fallEnrollmentAdditions?.[
      person.canonicalEmail
    ];
  if (fallAddition) return { stage: fallAddition.dealStage, outcome: null };

  const override = rulings.explicitStageOverrides?.[person.canonicalEmail];
  if (override)
    return { stage: override.stage, outcome: override.outcome ?? null };

  const labels = (person.pipelineStages ?? []).filter(
    (s) => PIPELINE_STAGE_TO_DEAL_STATE[s],
  );
  if (labels.length === 0) {
    return {
      unresolved: true,
      reason: (person.pipelineStages ?? []).length
        ? `unmapped-pipeline-stage-label:${person.pipelineStages.join("|")}`
        : "no-pipeline-stage-evidence",
    };
  }
  let best = null;
  for (const label of labels) {
    const candidate = PIPELINE_STAGE_TO_DEAL_STATE[label];
    if (
      !best ||
      STAGE_RANK.indexOf(candidate.stage) > STAGE_RANK.indexOf(best.stage)
    )
      best = candidate;
  }
  return { stage: best.stage, outcome: best.outcome };
}

/**
 * Compute the deterministic historical Contact/Deal/Enrollment operation
 * for one staged person record.
 *
 * @param {object} person - one record from the frozen staging manifest.
 * @param {HistoricalRulings} rulings
 */
/**
 * The Contact operation this person actually gets. Source classification
 * decides it, EXCEPT where an explicit human ruling establishes a reason
 * for the Contact to exist that the sources alone never could — e.g. the
 * Fall-2026 enrollment rulings, which cover people the source pass filed
 * as SKIP (`Acuity-only, no other meaningful reason to exist in CRM`).
 * Lives here, in the planner, so the manifest and the writer can never
 * disagree about who gets created (Phase 4P: they did, and the real
 * full-volume run caught it).
 */
/**
 * Collect every "these emails are DIFFERENT people" ruling. Keys ending in
 * `DoNotMerge` carry an `emails` array; they exist because an automated
 * identity pass merged records a human has since ruled must stay apart.
 */
function collectDoNotMergeGroups(rulings) {
  const groups = [];
  const scan = (obj) => {
    if (!obj || typeof obj !== "object") return;
    for (const [key, value] of Object.entries(obj)) {
      if (
        /DoNotMerge$/.test(key) &&
        Array.isArray(value?.emails) &&
        value.emails.length > 1
      ) {
        groups.push(value.emails.map((e) => String(e).trim().toLowerCase()));
      }
    }
  };
  scan(rulings);
  scan(rulings.gyuJanuaryReconciliation);
  return groups;
}

/**
 * Undo an identity merge the Phase 3 staging pass performed but a human
 * ruling forbids. The staging manifest is normally authoritative, but an
 * explicit ruling outranks it ("SOURCE TRUTH + LEIF'S HUMAN RULINGS WIN"):
 * where a ruling says two addresses are two different people, one merged
 * record has to become two, or the second person's history is silently
 * absorbed and disappears (this is exactly how one January GYU waitlist
 * membership went missing — 51 memberships arriving as 50 rows).
 *
 * Splitting is only safe for a record whose history is attributable
 * per-email. If the merged record carries Pipeline/Acuity/Stripe/
 * Application history, deciding which identity owns it is a human
 * judgement, not a mechanical one — so this throws rather than guess.
 */
export function applyIdentitySplitRulings(records, rulings) {
  const groups = collectDoNotMergeGroups(rulings);
  if (groups.length === 0) return records;
  const norm = (e) =>
    String(e ?? "")
      .trim()
      .toLowerCase();

  const out = [];
  for (const person of records) {
    const owned = new Set(
      [
        norm(person.canonicalEmail),
        ...(person.altEmails ?? []).map(norm),
      ].filter(Boolean),
    );
    const group = groups.find((g) => g.filter((e) => owned.has(e)).length > 1);
    if (!group) {
      out.push(person);
      continue;
    }
    const separated = group.filter((e) => owned.has(e));

    const hasUnattributableHistory =
      (person.pipelineStages ?? []).length > 0 ||
      (person.acuity?.total ?? 0) > 0 ||
      person.stripe?.customer ||
      (person.stripe?.checkoutSessions ?? []).length > 0 ||
      (person.stripe?.subscriptions ?? []).length > 0 ||
      person.hasApplication ||
      person.notionCallDate ||
      person.acuityEarliestCallDate;
    if (hasUnattributableHistory) {
      throw new Error(
        `Identity split ruling covers ${separated.join(" / ")}, but the merged record carries history that cannot be mechanically attributed to one of them (pipeline/acuity/stripe/application). Needs a human ruling, never a guess.`,
      );
    }

    // Emails outside the ruling stay with the record's own canonical
    // address rather than being duplicated onto every identity.
    const unrelated = [...owned].filter((e) => !separated.includes(e));
    for (const email of separated) {
      out.push({
        ...person,
        canonicalEmail: email,
        altEmails: email === norm(person.canonicalEmail) ? unrelated : [],
        _identitySplitFrom: norm(person.canonicalEmail),
      });
    }
  }
  return out;
}

export function resolveContactOperation(person, rulings) {
  const base = person.operation === "NEEDS_LEIF" ? "SKIP" : person.operation;
  if (base !== "SKIP") return base;
  if (
    rulings.gyuJanuaryReconciliation?.fallEnrollmentAdditions?.[
      person.canonicalEmail
    ]
  )
    return "CREATE";
  // A submitted Application is itself a meaningful reason to exist in the
  // CRM. The staging pass classified these people SKIP with the reason
  // "Acuity-only, no other meaningful reason to exist" — a label computed
  // BEFORE the two Notion Application databases were integrated, so for
  // anyone who actually applied the rule's own predicate is false. Honour
  // the rule rather than the stale label: dropping them would silently
  // erase real applicants (and their Applications, which have nothing to
  // attach to without a Contact).
  if (person.matchedApplications?.length > 0) return "CREATE";
  return base;
}

export function planPerson(person, rulings) {
  const canonicalStripeCustomerId =
    rulings.canonicalStripeCustomerOverrides[person.canonicalEmail] ??
    person.stripe?.customer ??
    null;

  let dealPlan = null;
  let enrollmentPlan = null;
  let offerIssue = null; // set when a Deal was otherwise warranted but Offer resolution failed — the Deal is NOT created; this is surfaced, never silently dropped.
  // Historical events this person's Deal/Enrollment write would generate —
  // never a fabricated multi-step chronology, only what's genuinely
  // independently evidenced (see plan.mjs's own module doc / the Phase 4C
  // report for the reasoning per case).
  const dealStageEvents = [];
  const enrollmentStatusEvents = [];

  const acuityCallDateKnown = person.acuityEarliestCallDate ?? null;

  // Phase 4N special case (Leif's explicit dual-offer ruling): a real
  // person for whom BOTH Living Example and Growing Yourself Up were
  // genuine opportunities — one Deal per Offer (the canonical model: one
  // Deal = one specific possible purchase), not one multi-offer Deal and
  // not a coin-flip pick. Her own single Pipeline row explicitly proves
  // she considered both AND that the same terminal fact ("couldn't afford
  // it") truthfully applies to both simultaneously — this is one real
  // event legitimately dual-attributed, never fabricated/copied history.
  // A one-off exception, not a generalized multi-deal mechanism — no other
  // person in the reconciled population needs this shape.
  if (rulings.sophieDualOfferRuling?.canonicalEmail === person.canonicalEmail) {
    const state = resolveDealStage(person, rulings);
    const ts = resolveDealTimestamps(person, rulings, [], state.stage);
    const dualDealPlans =
      state.unresolved || ts.unresolved
        ? null
        : [
            {
              offerId: 1,
              stage: state.stage,
              outcome: state.outcome,
              reason: "dual-offer-ruling",
              ...ts,
            },
            {
              offerId: 2,
              stage: state.stage,
              outcome: state.outcome,
              reason: "dual-offer-ruling",
              ...ts,
            },
          ];
    return {
      operation: resolveContactOperation(person, rulings),
      canonicalStripeCustomerId,
      dealPlan: null,
      dualDealPlans,
      offerIssue: dualDealPlans
        ? null
        : {
            email: person.canonicalEmail,
            branch: "dual-offer",
            ...(state.unresolved ? state : ts),
          },
      enrollmentPlan: null,
      dealStageEvents: [],
      enrollmentStatusEvents: [],
      acuityStructuredCount:
        person.operation !== "SKIP" ? (person.acuity?.current ?? 0) : 0,
      acuityDescriptiveOnlyCount:
        person.operation !== "SKIP" ? (person.acuity?.legacy ?? 0) : 0,
    };
  }

  if (rulings.pcEmails.includes(person.canonicalEmail)) {
    const offerResolution = resolveDealOfferId(person, rulings);
    if (offerResolution.offerId) {
      dealPlan = {
        stage: PC_DEAL_STAGE,
        outcome: PC_DEAL_OUTCOME,
        offerId: offerResolution.offerId,
        reason: "PC",
      };
    } else {
      offerIssue = {
        email: person.canonicalEmail,
        branch: "PC",
        ...offerResolution,
      };
    }
    // Two genuinely distinct, independently-evidenced dates for PC people:
    // the real Acuity call (call_booked) and the later Stripe-Customer
    // creation (committed) — both real, both different, so both are
    // recorded. Never more than these two. Only emitted when a Deal is
    // actually being created — an offerIssue means there's no Deal to
    // attach either event to.
    if (dealPlan) {
      if (acuityCallDateKnown)
        dealStageEvents.push({ stage: "call_booked", at: acuityCallDateKnown });
      if (person.stripe?.customerCreated) {
        dealStageEvents.push({
          stage: "committed",
          at: person.stripe.customerCreated,
        });
      }
    }
  } else if (rulings.ccRepresentable[person.canonicalEmail]) {
    const cc = rulings.ccRepresentable[person.canonicalEmail];
    dealPlan = {
      stage: cc.dealStage,
      offerId: cc.offerId,
      reason: "CC-representable",
    };
    enrollmentPlan = { status: "completed", reason: "CC-representable" };
    // Only ONE independently-known date exists for these two (the Acuity
    // call) — no separate "when they actually converted" date is evidenced,
    // so exactly one event each, not a fabricated second data point.
    if (acuityCallDateKnown) {
      dealStageEvents.push({
        stage: cc.dealStage,
        at: acuityCallDateKnown,
        approximate: true,
      });
      enrollmentStatusEvents.push({
        status: "completed",
        at: acuityCallDateKnown,
        approximate: true,
      });
    }
  } else if (rulings.ccContactOnly.includes(person.canonicalEmail)) {
    dealPlan = null;
    enrollmentPlan = null;
  } else if (person.pipelineStages?.length) {
    const offerResolution = resolveDealOfferId(person, rulings);
    const stageResolution = resolveDealStage(person, rulings);
    if (offerResolution.offerId && !stageResolution.unresolved) {
      dealPlan = {
        stage: stageResolution.stage,
        outcome: stageResolution.outcome,
        offerId: offerResolution.offerId,
        reason: "pipeline",
      };
    } else if (!offerResolution.offerId) {
      offerIssue = {
        email: person.canonicalEmail,
        branch: "pipeline",
        ...offerResolution,
      };
    } else {
      offerIssue = {
        email: person.canonicalEmail,
        branch: "pipeline-stage",
        ...stageResolution,
      };
    }
    if (person.pipelineStages.includes("Completed / Past Client")) {
      enrollmentPlan = { status: "completed", reason: "pipeline-past-client" };
    } else if (person.pipelineStages.includes("Active Client")) {
      enrollmentPlan = { status: "active", reason: "pipeline-active-client" };
    }
    // Ordinary Pipeline people: only the Call Date is independently known —
    // one deal_stage_event, at whatever the real frozen final stage is.
    // Never a fabricated intermediate chronology beyond what's evidenced.
    //
    // dateEvidenceType distinguishes what the known date actually proves:
    //   'call' (default)          — a real Call Date/Acuity appointment;
    //                                the stage transition itself is evidenced.
    //   'application_submission'  — a real application submission date;
    //                                evidences 'application_received', not a
    //                                call — labeled as such, not silently
    //                                treated as a call date.
    //   'administrative_only'     — e.g. a waitlist join date: proves the
    //                                person existed/was in contact by then,
    //                                proves NOTHING about when any Deal
    //                                stage was actually entered. Used ONLY
    //                                to satisfy deals.stage_entered_at's
    //                                NOT NULL constraint — never turned into
    //                                a deal_stage_events row, which would be
    //                                an unsupported historical claim.
    const evidenceType = person.dateEvidenceType ?? "call";
    if (dealPlan && acuityCallDateKnown && evidenceType === "call") {
      // Phase 4N: the real resolved stage — no longer a "final-frozen-stage"
      // placeholder string, which was never a valid deals.stage value.
      dealStageEvents.push({
        stage: dealPlan.stage,
        at: acuityCallDateKnown,
        approximate: true,
      });
    } else if (
      dealPlan &&
      acuityCallDateKnown &&
      evidenceType === "application_submission"
    ) {
      dealStageEvents.push({
        stage: "application_received",
        at: acuityCallDateKnown,
        approximate: false,
      });
    }
    // evidenceType === 'administrative_only': deliberately NO deal_stage_event
    // — see the comment block above. The Deal itself still needs
    // stage_entered_at populated (schema NOT NULL); that's the writer's
    // concern (uses acuityCallDateKnown as the column value only), not an
    // additional historical claim this planner should assert.

    if (
      dealPlan &&
      enrollmentPlan &&
      acuityCallDateKnown &&
      evidenceType === "call"
    ) {
      enrollmentStatusEvents.push({
        status: enrollmentPlan.status,
        at: acuityCallDateKnown,
        approximate: true,
      });
    }
  }

  // Phase 4O: resolve created_at/updated_at/stage_entered_at for the
  // finalized dealPlan — a single, universal post-processing step (rather
  // than threading timestamp logic through every branch above) so every
  // Deal this planner ever produces goes through the exact same real-
  // evidence resolution, never a fabricated fallback. An otherwise-
  // warranted Deal with genuinely no date evidence at all is NOT created
  // — surfaced as an offerIssue-shaped issue, never defaulted to now().
  if (dealPlan && !dealPlan.createdAt) {
    const ts = resolveDealTimestamps(
      person,
      rulings,
      dealStageEvents,
      dealPlan.stage,
    );
    if (ts.unresolved) {
      offerIssue = {
        email: person.canonicalEmail,
        branch: "timestamps",
        reason: "no-date-evidence-at-all",
      };
      dealPlan = null;
    } else {
      dealPlan = {
        ...dealPlan,
        createdAt: ts.createdAt,
        updatedAt: ts.updatedAt,
        stageEnteredAt: ts.stageEnteredAt,
        stageEnteredAtEvidence: ts.stageEnteredAtEvidence,
      };
    }
  }

  return {
    operation: resolveContactOperation(person, rulings),
    canonicalStripeCustomerId,
    dealPlan,
    enrollmentPlan,
    dealStageEvents,
    enrollmentStatusEvents,
    // Set only when a Deal was otherwise warranted (PC or ordinary
    // Pipeline) but Offer/Stage/timestamp resolution genuinely failed
    // (conflicting or absent source evidence) — the Deal is NOT created;
    // this must be surfaced to a human, never silently dropped (Phase 4M/N/O).
    offerIssue,
    // Structured Acuity attachment: only current-type appointments become
    // a real sales_calls/client_sessions row (deterministic offer via
    // CLIENT_SESSION_TYPE_TO_OFFER, or no offer needed at all for a sales
    // call) — legacy-type appointments for this same person stay
    // descriptive-only, never a fabricated current-Offer client_session.
    acuityStructuredCount:
      person.operation !== "SKIP" ? (person.acuity?.current ?? 0) : 0,
    acuityDescriptiveOnlyCount:
      person.operation !== "SKIP" ? (person.acuity?.legacy ?? 0) : 0,
  };
}

/**
 * Summarize a full staged population into the exact counts the frozen
 * Phase 3 manifest is expressed in, across every entity type. Pure,
 * deterministic, no I/O.
 *
 * @param {object[]} records - the frozen manifest's `records` array.
 * @param {HistoricalRulings} rulings
 */
export function summarizePlan(records, rulings) {
  const contacts = { CREATE: 0, UPDATE: 0, SKIP: 0, NEEDS_LEIF: 0 };
  let dealsCreate = 0;
  let pcDealsCommittedNurture = 0;
  let ccStructuredDeals = 0;
  let enrollmentsCreate = 0;
  let enrollmentsActive = 0;
  let enrollmentsCompleted = 0;
  let ccContactOnlyCount = 0;
  let dealStageEventsTotal = 0;
  // Rows the writer ISSUES: orchestrate deliberately inserts only
  // dealStageEvents.slice(0, -1), because record_deal_stage_event() writes
  // the final one itself from the Deal it is attached to.
  let dealStageEventsExplicitRows = 0;
  let enrollmentStatusEventsTotal = 0;
  let acuityStructuredTotal = 0;
  let acuityDescriptiveOnlyTotal = 0;
  let waitlistEntryRows = 0;
  let pipelineWithApplication = 0;
  let pipelineWithoutApplication = 0;
  let dealsLeOffer = 0;
  let dealsGyuOffer = 0;
  const offerIssues = [];
  const dealsByStage = {};
  const dealsByOutcome = { none: 0 };

  const validateAndCountDeal = (deal, email) => {
    // Plan-level invariants (Phase 4M/4N — real Postgres rejected every
    // Deal this used to leave offerId/stage unset for): manifest
    // generation must FAIL rather than let an un-resolvable Deal reach the
    // writer. Should be unreachable given resolveDealOfferId/
    // resolveDealStage's own contracts — asserted as defense-in-depth, not
    // the primary control path (offerIssue tracking is).
    if (deal.offerId !== 1 && deal.offerId !== 2) {
      throw new Error(
        `summarizePlan: a Deal was planned for "${email}" with an invalid offerId (${deal.offerId}) — refusing to generate a manifest containing an unresolvable Deal.`,
      );
    }
    if (!STAGE_RANK.includes(deal.stage)) {
      throw new Error(
        `summarizePlan: a Deal was planned for "${email}" with an invalid stage (${deal.stage}) — refusing to generate a manifest containing an unresolvable Deal.`,
      );
    }
    if (
      deal.outcome != null &&
      ![
        "nurture",
        "needs_higher_care",
        "not_fit",
        "lost",
        "workshops_only",
      ].includes(deal.outcome)
    ) {
      throw new Error(
        `summarizePlan: a Deal was planned for "${email}" with an invalid outcome (${deal.outcome}).`,
      );
    }
    // Phase 4O: full schema-conformance preflight for the three required
    // timestamp columns — every NOT NULL Deal column checked BEFORE a
    // manifest is ever generated, not discovered one column at a time by
    // real Postgres.
    for (const field of ["createdAt", "updatedAt", "stageEnteredAt"]) {
      if (!deal[field]) {
        throw new Error(
          `summarizePlan: a Deal was planned for "${email}" with missing ${field} — refusing to generate a manifest containing a Deal that would violate a NOT NULL constraint.`,
        );
      }
    }
    dealsCreate++;
    if (deal.offerId === 1) dealsLeOffer++;
    if (deal.offerId === 2) dealsGyuOffer++;
    dealsByStage[deal.stage] = (dealsByStage[deal.stage] ?? 0) + 1;
    if (deal.outcome)
      dealsByOutcome[deal.outcome] = (dealsByOutcome[deal.outcome] ?? 0) + 1;
    else dealsByOutcome.none++;
  };

  for (const person of records) {
    const planned = planPerson(person, rulings);
    contacts[planned.operation] = (contacts[planned.operation] ?? 0) + 1;

    if (planned.offerIssue) offerIssues.push(planned.offerIssue);

    if (planned.dualDealPlans) {
      for (const deal of planned.dualDealPlans)
        validateAndCountDeal(deal, person.canonicalEmail);
    } else if (planned.dealPlan) {
      validateAndCountDeal(planned.dealPlan, person.canonicalEmail);
      if (rulings.pcEmails.includes(person.canonicalEmail))
        pcDealsCommittedNurture++;
      if (rulings.ccRepresentable[person.canonicalEmail]) ccStructuredDeals++;
    }
    if (rulings.ccContactOnly.includes(person.canonicalEmail))
      ccContactOnlyCount++;

    if (planned.enrollmentPlan) {
      enrollmentsCreate++;
      if (planned.enrollmentPlan.status === "active") enrollmentsActive++;
      if (planned.enrollmentPlan.status === "completed") enrollmentsCompleted++;
    }

    dealStageEventsTotal += planned.dealStageEvents.length;
    dealStageEventsExplicitRows += Math.max(
      planned.dealStageEvents.length - 1,
      0,
    );
    enrollmentStatusEventsTotal += planned.enrollmentStatusEvents.length;
    acuityStructuredTotal += planned.acuityStructuredCount;
    acuityDescriptiveOnlyTotal += planned.acuityDescriptiveOnlyCount;

    if (planned.operation !== "SKIP") {
      if (person.waitlist?.LE) waitlistEntryRows++;
      if (person.waitlist?.GYU) waitlistEntryRows++;
      if (person.pipelineStages?.length) {
        const hasApplication = person.hasApplication ?? null;
        if (hasApplication === true) pipelineWithApplication++;
        else if (hasApplication === false) pipelineWithoutApplication++;
      }
    }
  }

  return {
    contacts,
    deals: {
      create: dealsCreate,
      pcCommittedNurture: pcDealsCommittedNurture,
      ccStructured: ccStructuredDeals,
      leOffer: dealsLeOffer,
      gyuOffer: dealsGyuOffer,
      byStage: dealsByStage,
      byOutcome: dealsByOutcome,
    },
    offerIssues,
    enrollments: {
      create: enrollmentsCreate,
      active: enrollmentsActive,
      completed: enrollmentsCompleted,
      deliberatelyAbsentLegacyCC: ccContactOnlyCount,
    },
    waitlistEntryRows,
    applications: {
      withApplication: pipelineWithApplication,
      withoutApplication: pipelineWithoutApplication,
    },
    events: {
      dealStageEvents: dealStageEventsTotal,
      dealStageEventsExplicitRows,
      enrollmentStatusEvents: enrollmentStatusEventsTotal,
      operationalTasks: 0,
    },
    acuity: {
      structured: acuityStructuredTotal,
      descriptiveOnly: acuityDescriptiveOnlyTotal,
    },
  };
}

/**
 * Compare a computed summary against the frozen manifest's accepted
 * totals. Returns an empty array when everything reconciles — never
 * silently adjusts either side to force a match.
 */
export function diffAgainstFrozenManifest(computed, frozen) {
  const discrepancies = [];
  for (const key of Object.keys(frozen)) {
    if (computed[key] !== frozen[key]) {
      discrepancies.push({ key, expected: frozen[key], actual: computed[key] });
    }
  }
  return discrepancies;
}
