// Historical Migration slice — the batch orchestrator. Ties plan.mjs's
// pure decisions to write.mjs's entity-specific writers in one traced call
// path, so "a writer function exists" and "a writer function is actually
// invoked for a real person" are the same claim, not two different ones.
//
// Call path for one person (all inside the caller's already-open
// migration-mode transaction):
//
//   importPerson()
//     -> planPerson()                              (plan.mjs, pure)
//     -> upsertHistoricalContact()                 (write.mjs)
//        -> if operation is "already-imported"/"SKIP": return early, no
//           further writer is called for this person at all.
//     -> if dealPlan:      insertHistoricalDeal()
//                          -> insertSupplementaryDealStageEvent() (0..N times,
//                             only for genuinely independently-evidenced
//                             earlier stages — see plan.mjs's own event
//                             logic; never invented)
//     -> if dealPlan && hasApplicationEvidence: insertHistoricalApplication()
//     -> if waitlist.LE:   insertHistoricalWaitlistEntry() (offer 1)
//     -> if waitlist.GYU:  insertHistoricalWaitlistEntry() (offer 2)
//     -> if enrollmentPlan: insertHistoricalEnrollment()
//                          -> insertHistoricalEnrollmentStatusEvent() (0..1,
//                             only if a truthful date is known)
//     -> for each structured Acuity appointment (acuity.current):
//          insertHistoricalSalesCall() or insertHistoricalClientSession(),
//          per the appointment's own type (see plan.mjs's
//          CLIENT_SESSION_TYPE_TO_OFFER / SALES_CALL_TYPE_IDS)
//
// Every step after the Contact upsert is skipped entirely when the Contact
// step itself returns "already-imported" — an idempotent rerun of the
// whole batch does zero additional writes for a person already imported,
// by construction, not by re-checking each entity separately.

import {
  planPerson,
  CLIENT_SESSION_TYPE_TO_OFFER,
  SALES_CALL_TYPE_IDS,
  OFFER_ID_BY_PROGRAM,
} from "./plan.mjs";
import {
  mapHistoricalAnswers,
  mapHistoricalStatus,
} from "./applicationMapping.mjs";
import {
  upsertHistoricalContact,
  insertHistoricalDeal,
  insertSupplementaryDealStageEvent,
  insertHistoricalApplication,
  insertHistoricalWaitlistEntry,
  insertHistoricalEnrollment,
  insertHistoricalEnrollmentStatusEvent,
  insertHistoricalSalesCall,
  insertHistoricalClientSession,
} from "./write.mjs";

/**
 * Import one person's complete historical record, tracing which writer
 * functions were actually invoked (for audit/test purposes — see
 * orchestrate.test.mjs's call-path assertions).
 *
 * @param {import('pg').PoolClient} client
 * @param {object} person - one record from the frozen staging manifest.
 * @param {import('./plan.mjs').HistoricalRulings} rulings
 * @param {{ batchId: string, appointmentsByEmail?: object[] }} options
 * @returns {Promise<{ calledWriters: string[], contactId: number, dealId: number|null, enrollmentId: number|null }>}
 */
export async function importPerson(client, person, rulings, options) {
  const { batchId } = options;
  const calledWriters = [];
  const sourceKeyBase = `phase3-2026:${person.canonicalEmail}`;

  const planned = planPerson(person, rulings);

  if (planned.operation === "SKIP") {
    return { calledWriters, contactId: null, dealId: null, enrollmentId: null };
  }

  calledWriters.push("upsertHistoricalContact");
  const contactResult = await upsertHistoricalContact(client, {
    sourceKey: sourceKeyBase,
    sourceSystem: person.pipelineStages?.length
      ? "notion_pipeline"
      : person.waitlist?.LE || person.waitlist?.GYU
        ? "notion_waitlist"
        : "stripe",
    batchId,
    canonicalEmail: person.canonicalEmail,
    altEmails: person.altEmails ?? [],
    firstName: person.names?.[0]?.split(" ")[0] ?? "",
    lastName: person.names?.[0]?.split(" ").slice(1).join(" ") ?? "",
    stripeCustomerId: planned.canonicalStripeCustomerId,
  });

  if (contactResult.operation === "already-imported") {
    // Idempotent rerun: stop here. Every downstream writer below is only
    // ever reached on a genuinely NEW import, never re-invoked for a
    // person already fully imported.
    return {
      calledWriters,
      contactId: contactResult.contactId,
      dealId: null,
      enrollmentId: null,
    };
  }

  let dealId = null;
  const dealIds = [];
  if (planned.dualDealPlans) {
    // Phase 4N one-off: two real Deals for one Contact (Leif's explicit
    // dual-offer ruling — see plan.mjs's own comment). Each gets its own
    // source key (":deal:LE" / ":deal:GYU") so they're independently
    // idempotent; dealId (singular) stays null since no single Deal
    // "belongs" to this person's Application/Enrollment path here.
    for (const deal of planned.dualDealPlans) {
      const offerLabel = deal.offerId === 1 ? "LE" : "GYU";
      calledWriters.push("insertHistoricalDeal");
      const dealResult = await insertHistoricalDeal(client, {
        sourceKey: `${sourceKeyBase}:deal:${offerLabel}`,
        sourceSystem: "notion_pipeline",
        batchId,
        contactId: contactResult.contactId,
        offerId: deal.offerId,
        stage: deal.stage,
        outcome: deal.outcome ?? null,
        name: person.names?.[0] ?? person.canonicalEmail,
        // Phase 4O: three independently-resolved real timestamps, already
        // computed by planPerson's resolveDealTimestamps — never a single
        // value reused for all three (see write.mjs's own guard).
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt,
        stageEnteredAt: deal.stageEnteredAt,
        stageEnteredAtEvidence: deal.stageEnteredAtEvidence,
        cohortId: null,
      });
      dealIds.push(dealResult.dealId);
    }
  } else if (planned.dealPlan) {
    calledWriters.push("insertHistoricalDeal");
    const dealResult = await insertHistoricalDeal(client, {
      sourceKey: `${sourceKeyBase}:deal`,
      sourceSystem: "notion_pipeline",
      batchId,
      contactId: contactResult.contactId,
      offerId: planned.dealPlan.offerId ?? null,
      stage: planned.dealPlan.stage,
      outcome: planned.dealPlan.outcome ?? null,
      name: person.names?.[0] ?? person.canonicalEmail,
      // Phase 4O: independently-resolved real timestamps (see plan.mjs's
      // resolveDealTimestamps) — never a single value standing in for all
      // three required columns.
      createdAt: planned.dealPlan.createdAt,
      updatedAt: planned.dealPlan.updatedAt,
      stageEnteredAt: planned.dealPlan.stageEnteredAt,
      stageEnteredAtEvidence: planned.dealPlan.stageEnteredAtEvidence,
      cohortId: null,
    });
    dealId = dealResult.dealId;

    for (const event of planned.dealStageEvents.slice(0, -1)) {
      calledWriters.push("insertSupplementaryDealStageEvent");
      await insertSupplementaryDealStageEvent(client, {
        dealId,
        stage: event.stage,
        enteredAt: event.at,
      });
    }
  }

  // Phase 4I: an Application no longer requires a Deal to exist (dealId may
  // be null here — Leif's explicit architecture ruling: Application/Offer/
  // Cohort-intent is a fact independent of whether a sales Opportunity
  // exists). Moved out of the `if (planned.dealPlan)` block above so a
  // Contact+Application-only person (no Deal at all, e.g. most of the
  // GYU-outside-Pipeline population) still gets their real Application.
  //
  // An Application is created ONLY from a genuinely matched ORIGINAL Notion
  // application record (person.matchedApplications — one entry per real
  // source row, populated by the identity-reconciliation pass, never
  // fabricated here), never from the downstream Pipeline's hasApplication
  // boolean. A person can legitimately have 0, 1, or several (LE and GYU,
  // or a genuine resubmission) — each gets its own deterministic source key
  // (the Notion page URL itself, not the person's email) so two real
  // applications for the same person are never collapsed, and an exact
  // retry of the same page is never duplicated.
  for (const app of person.matchedApplications ?? []) {
    const status = mapHistoricalStatus(app.status);
    if (!status) {
      // An unrecognized historical Status must never silently become
      // 'pending' — that would assert a fact the source doesn't support.
      throw new Error(
        `Application ${app.sourceUrl}: unrecognized historical status "${app.status}" — NEEDS_LEIF, not a guessable default`,
      );
    }
    const { answers } = mapHistoricalAnswers(app.program, app.rawFields);
    const offerId = OFFER_ID_BY_PROGRAM[app.program];
    let intendedCohortId = null;
    if (app.intendedCohortName) {
      // Resolved by name at import time, never hardcoded — the Cohort's
      // real id isn't known until it's actually created (see the Phase 4I
      // migration proposal). Fails closed: an intended cohort name that
      // doesn't resolve to a real row is a data problem to surface, not a
      // silently-dropped fact.
      const cohortLookup = await client.query(
        `select id from cohorts where offer_id = $1 and name = $2`,
        [offerId, app.intendedCohortName],
      );
      if (cohortLookup.rows.length === 0) {
        throw new Error(
          `Application ${app.sourceUrl}: intended cohort "${app.intendedCohortName}" does not exist — create it first, never guess an id`,
        );
      }
      intendedCohortId = cohortLookup.rows[0].id;
    }
    calledWriters.push("insertHistoricalApplication");
    await insertHistoricalApplication(client, {
      sourceKey: app.sourceUrl,
      sourceSystem: "notion_application",
      batchId,
      // The Contact is the canonical relationship and always exists here
      // (the Contact upsert runs before any of this). The Deal is optional:
      // an applicant who never became an Opportunity keeps a null
      // opportunity_id rather than getting a fabricated Deal.
      contactId: contactResult.contactId,
      dealId,
      status,
      submittedAt: app.submittedAt,
      rawAnswers: answers,
      offerId,
      intendedCohortId,
    });
  }

  // priority + notes carry the order-confidence distinction all the way to
  // the row (see insertHistoricalWaitlistEntry): a real Applied Order only
  // where the source confirms one, and an explicit caveat whenever
  // joined_at is the source's bulk/data-entry timestamp rather than the
  // person's actual known join date. Dropping them here is what let the LE
  // population reach the database with neither an order nor a join date.
  if (person.waitlist?.LE) {
    calledWriters.push("insertHistoricalWaitlistEntry:LE");
    await insertHistoricalWaitlistEntry(client, {
      sourceKey: `${sourceKeyBase}:waitlist:1`,
      sourceSystem: "notion_waitlist",
      batchId,
      contactId: contactResult.contactId,
      offerId: 1,
      cohortId: null,
      status: "waiting",
      joinedAt: person.waitlistJoinedAt?.LE ?? null,
      priority: person.waitlistPriority?.LE ?? null,
      notes: person.waitlistNotes?.LE ?? null,
    });
  }
  if (person.waitlist?.GYU) {
    calledWriters.push("insertHistoricalWaitlistEntry:GYU");
    await insertHistoricalWaitlistEntry(client, {
      sourceKey: `${sourceKeyBase}:waitlist:2`,
      sourceSystem: "notion_waitlist",
      batchId,
      contactId: contactResult.contactId,
      offerId: 2,
      cohortId: null,
      status: "waiting",
      joinedAt: person.waitlistJoinedAt?.GYU ?? null,
      priority: person.waitlistPriority?.GYU ?? null,
      notes: person.waitlistNotes?.GYU ?? null,
    });
  }

  let enrollmentId = null;
  if (planned.enrollmentPlan && dealId) {
    calledWriters.push("insertHistoricalEnrollment");
    const enrollmentResult = await insertHistoricalEnrollment(client, {
      sourceKey: `${sourceKeyBase}:enrollment`,
      sourceSystem: "notion_pipeline",
      batchId,
      dealId,
      status: planned.enrollmentPlan.status,
      startDate: null,
      endDate: null,
    });
    enrollmentId = enrollmentResult.enrollmentId;

    const event = planned.enrollmentStatusEvents[0];
    if (event) {
      calledWriters.push("insertHistoricalEnrollmentStatusEvent");
      await insertHistoricalEnrollmentStatusEvent(client, {
        enrollmentId,
        status: event.status,
        enteredAt: event.at,
      });
    }
  }

  for (const appt of person.structuredAcuityAppointments ?? []) {
    if (SALES_CALL_TYPE_IDS.has(Number(appt.appointmentTypeID))) {
      calledWriters.push("insertHistoricalSalesCall");
      await insertHistoricalSalesCall(client, {
        contactId: contactResult.contactId,
        dealId,
        acuityAppointmentId: appt.id,
        acuityAppointmentTypeId: String(appt.appointmentTypeID),
        scheduledAt: appt.datetime,
        attendance: appt.attendance ?? null,
      });
    } else if (CLIENT_SESSION_TYPE_TO_OFFER[Number(appt.appointmentTypeID)]) {
      calledWriters.push("insertHistoricalClientSession");
      await insertHistoricalClientSession(client, {
        contactId: contactResult.contactId,
        enrollmentId,
        offerId: CLIENT_SESSION_TYPE_TO_OFFER[Number(appt.appointmentTypeID)],
        acuityAppointmentId: appt.id,
        acuityAppointmentTypeId: String(appt.appointmentTypeID),
        scheduledAt: appt.datetime,
        status: "completed",
      });
    }
  }

  return {
    calledWriters,
    contactId: contactResult.contactId,
    dealId,
    enrollmentId,
  };
}
