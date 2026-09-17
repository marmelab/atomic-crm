// Historical Migration slice — the WRITE half of the importer. Entity-
// specific functions, deliberately NOT a generic dynamic-table writer —
// each destination table has different real constraints and different
// truthful-representation rules (see the Phase 4 checkpoint reports for
// the full reasoning), so each gets its own function reflecting that.
//
// Every function here expects an already-connected `pg`-compatible client
// whose session has already called `select set_historical_migration_mode(true)`
// for the surrounding transaction — this module never calls that itself,
// so the caller controls exactly which statements run under migration mode.
//
// Shared idempotency shape across every entity: look up
// historical_import_records for (entity_table, source_key) FIRST.
//   - no row, no live destination match -> CREATE, record the ledger row.
//   - a row exists, entity_id matches a fresh destination lookup -> already
//     imported, safe no-op (exact retry).
//   - a row exists, entity_id does NOT match a fresh lookup -> throw. Never
//     a bare `ON CONFLICT DO NOTHING` — that cannot tell those two cases
//     apart (see the Phase 4B collision proof).
//   - no ledger row, but a live destination match already exists (only
//     possible for Contacts in this migration — see contactSourceKey) ->
//     UPDATE path, enrich only, never overwrite a non-null legitimate value.

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

/** @see the module doc above for the shared conflict/idempotency shape. */
export async function upsertHistoricalContact(client, input) {
  const {
    sourceKey,
    sourceSystem,
    batchId,
    canonicalEmail,
    altEmails,
    firstName,
    lastName,
    stripeCustomerId,
  } = input;

  const existingLedger = await client.query(
    `select entity_id from historical_import_records where entity_table = 'contacts' and source_key = $1`,
    [sourceKey],
  );
  // Probe EVERY email this person is known to own, not just the canonical
  // one. People routinely signed up to the live CRM with a different
  // address than the one the historical sources treat as canonical, and
  // contacts carries no unique email index — so a canonical-only probe
  // silently creates a second Contact for somebody already in the CRM.
  // Compared case-insensitively because live rows are whatever the person
  // typed.
  const knownEmails = [canonicalEmail, ...(altEmails ?? [])]
    .filter(Boolean)
    .map((e) => String(e).trim().toLowerCase());
  const existingContact = await client.query(
    `select id, first_name, last_name, stripe_customer_id, email_jsonb
       from contacts
      where exists (
        select 1 from jsonb_array_elements(email_jsonb) e
         where lower(e->>'email') in (select lower(value) from jsonb_array_elements_text($1::jsonb))
      )
      order by id`,
    [JSON.stringify(knownEmails)],
  );

  // Their emails reaching two DIFFERENT existing Contacts is a real merge
  // decision (which record is the person? should the two be merged at
  // all?) and merging live CRM rows is destructive. Fail closed.
  if (existingContact.rows.length > 1) {
    throw new Error(
      `Ambiguous identity for ${sourceKey}: this person's known emails match ${existingContact.rows.length} different existing contacts (ids ${existingContact.rows.map((r) => r.id).join(", ")}). Refusing to auto-merge live CRM records — needs human review.`,
    );
  }

  if (existingLedger.rows.length > 0) {
    const ledgerEntityId = existingLedger.rows[0].entity_id;
    const freshMatchId = existingContact.rows[0]?.id ?? null;
    if (freshMatchId !== null && freshMatchId !== ledgerEntityId) {
      throw new Error(
        `Source-key collision: "${sourceKey}" already maps to contact ${ledgerEntityId}, but a fresh lookup now finds contact ${freshMatchId}. Refusing — needs human review, not auto-merge.`,
      );
    }
    return { contactId: ledgerEntityId, operation: "already-imported" };
  }

  if (existingContact.rows.length > 0) {
    const existing = existingContact.rows[0];
    const mergedEmails = mergeEmailArrays(existing.email_jsonb ?? [], [
      canonicalEmail,
      ...altEmails,
    ]);
    if (
      existing.stripe_customer_id &&
      stripeCustomerId &&
      existing.stripe_customer_id !== stripeCustomerId
    ) {
      throw new Error(
        `Conflict on contact ${existing.id}: existing legitimate stripe_customer_id (${existing.stripe_customer_id}) differs from the historical value (${stripeCustomerId}). Refusing to overwrite.`,
      );
    }
    await client.query(
      `update contacts set first_name = coalesce(first_name, $1), last_name = coalesce(last_name, $2), stripe_customer_id = coalesce(stripe_customer_id, $3), email_jsonb = $4 where id = $5`,
      [
        firstName,
        lastName,
        stripeCustomerId,
        JSON.stringify(mergedEmails),
        existing.id,
      ],
    );
    await recordProvenance(client, {
      entityTable: "contacts",
      entityId: existing.id,
      sourceKey,
      sourceSystem,
      operation: "update",
      batchId,
    });
    return { contactId: existing.id, operation: "update" };
  }

  const emailJsonb = [canonicalEmail, ...altEmails].map((email) => ({
    email,
    type: "other",
  }));
  const inserted = await client.query(
    `insert into contacts (first_name, last_name, email_jsonb, stripe_customer_id, sales_eligibility)
     values ($1, $2, $3, $4, 'normal') returning id`,
    [firstName, lastName, JSON.stringify(emailJsonb), stripeCustomerId],
  );
  const contactId = inserted.rows[0].id;
  await recordProvenance(client, {
    entityTable: "contacts",
    entityId: contactId,
    sourceKey,
    sourceSystem,
    operation: "create",
    batchId,
  });
  return { contactId, operation: "create" };
}

export function mergeEmailArrays(existing, incomingEmails) {
  const seen = new Map();
  for (const entry of existing) {
    if (entry?.email) seen.set(entry.email.toLowerCase().trim(), entry);
  }
  for (const email of incomingEmails) {
    const key = email.toLowerCase().trim();
    if (!seen.has(key)) seen.set(key, { email: key, type: "other" });
  }
  return Array.from(seen.values());
}

// ---------------------------------------------------------------------------
// Deals — no dedicated unique constraint of its own for this migration;
// idempotency is entirely historical_import_records + the 1:1 relationship
// this migration establishes between one Contact and at most one historical
// Deal (never an UPDATE path — the 11 pre-existing real Contacts' own real
// Deals are live business state this migration must never touch at all).
// ---------------------------------------------------------------------------

export async function insertHistoricalDeal(client, input) {
  const {
    sourceKey,
    sourceSystem,
    batchId,
    contactId,
    offerId,
    stage,
    outcome,
    name,
    createdAt,
    updatedAt,
    stageEnteredAt,
    stageEnteredAtEvidence,
    cohortId,
  } = input;

  // Fail-fast guard (Phase 4M, defense-in-depth): real Postgres's own
  // handle_deal_saved() trigger already rejects a null/invalid offer_id
  // (that's how this defect was originally caught) — this guard exists
  // so a malformed call never even reaches the network, with a clearer
  // error message pointing at the actual planner defect. The database
  // constraint/trigger remains the authoritative, unchanged source of
  // truth; this is a narrower, earlier check, not a replacement for it.
  if (offerId !== 1 && offerId !== 2) {
    throw new Error(
      `insertHistoricalDeal: refusing to write a Deal with invalid offerId (${offerId}) for sourceKey "${sourceKey}" — the planner must resolve a real Offer before calling this writer.`,
    );
  }
  const VALID_STAGES = new Set([
    "interested",
    "application_received",
    "approved",
    "call_booked",
    "decision",
    "committed",
    "won",
  ]);
  if (!VALID_STAGES.has(stage)) {
    throw new Error(
      `insertHistoricalDeal: refusing to write a Deal with invalid stage (${stage}) for sourceKey "${sourceKey}" — the planner must resolve a real canonical stage before calling this writer.`,
    );
  }
  // Phase 4O: three independent, required timestamps — deals.created_at/
  // updated_at/stage_entered_at are ALL NOT NULL. No single value silently
  // stands in for all three (that's the exact defect real Postgres caught).
  // The planner is responsible for resolving each with real evidence; this
  // writer only refuses to send SQL that would violate the known
  // constraint, never invents now() as a convenience fallback.
  for (const [label, value] of [
    ["createdAt", createdAt],
    ["updatedAt", updatedAt],
    ["stageEnteredAt", stageEnteredAt],
  ]) {
    if (!value) {
      throw new Error(
        `insertHistoricalDeal: refusing to write a Deal with missing ${label} for sourceKey "${sourceKey}" — the planner must resolve real historical evidence before calling this writer, never now().`,
      );
    }
  }

  const existingLedger = await client.query(
    `select entity_id from historical_import_records where entity_table = 'deals' and source_key = $1`,
    [sourceKey],
  );
  if (existingLedger.rows.length > 0) {
    return {
      dealId: existingLedger.rows[0].entity_id,
      operation: "already-imported",
    };
  }

  const inserted = await client.query(
    `insert into deals (name, contact_id, offer_id, cohort_id, stage, outcome, pricing_mode, stage_entered_at, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, 'standard', $7, $8, $9) returning id`,
    [
      name,
      contactId,
      offerId,
      cohortId ?? null,
      stage,
      outcome ?? null,
      stageEnteredAt,
      createdAt,
      updatedAt,
    ],
  );
  const dealId = inserted.rows[0].id;
  await recordProvenance(client, {
    entityTable: "deals",
    entityId: dealId,
    sourceKey,
    sourceSystem,
    operation: "create",
    batchId,
    // Phase 4P: stage_entered_at is NOT NULL and drives live Kanban
    // ordering, so every historical Deal carries one — this records how
    // strongly the source actually evidenced it.
    evidenceNotes: stageEnteredAtEvidence
      ? `stage_entered_at:${stageEnteredAtEvidence}`
      : null,
  });
  return { dealId, operation: "create" };
}

/**
 * Supplementary historical deal_stage_events row. Only for a genuinely
 * independently-evidenced EARLIER stage than the one the Deal's own INSERT
 * already generated via record_deal_stage_event() (that trigger fires
 * exactly once, for the stage the row was inserted at — see
 * set_deal_stage_entered_at()'s migration-mode guard). This function is
 * for the 14 PC people's real, separately-dated call_booked moment only —
 * never call it to invent an intermediate chronology that isn't evidenced.
 */
export async function insertSupplementaryDealStageEvent(
  client,
  { dealId, stage, enteredAt },
) {
  await client.query(
    `insert into deal_stage_events (opportunity_id, stage, entered_at) values ($1, $2, $3)`,
    [dealId, stage, enteredAt],
  );
}

// ---------------------------------------------------------------------------
// Applications — no dedicated unique constraint; historical_import_records
// only. Deliberately NOT calling submit_public_application()/the live
// public-application intake path — that function stamps now()-based
// timestamps and is meant for a real prospect submitting today.
// ---------------------------------------------------------------------------

export async function insertHistoricalApplication(client, input) {
  const {
    sourceKey,
    sourceSystem,
    batchId,
    contactId,
    dealId,
    status,
    submittedAt,
    reviewedAt,
    rawAnswers,
    offerId,
    intendedCohortId,
  } = input;

  // An Application belongs to a Contact. A Deal is optional; a Contact is
  // not. Refuse before issuing any SQL rather than writing a row nothing
  // can ever reach from a person — which is precisely the state Gate A
  // found 88 legitimate historical Applications in.
  if (contactId == null) {
    throw new Error(
      `Refusing to write applications row for ${sourceKey}: contact_id is required — an Application must belong to a Contact. Never fabricate a Deal or a Contact to satisfy this.`,
    );
  }

  const existingLedger = await client.query(
    `select entity_id from historical_import_records where entity_table = 'applications' and source_key = $1`,
    [sourceKey],
  );
  if (existingLedger.rows.length > 0) {
    return {
      applicationId: existingLedger.rows[0].entity_id,
      operation: "already-imported",
    };
  }

  // offerId is required (Phase 4I: an Application must always say what it
  // was for) — never silently null even though the column itself is
  // nullable for backward compatibility with pre-Phase-4I rows.
  // intendedCohortId is genuinely optional (null for The Living Example,
  // for a GYU applicant with no stated intent, etc.).
  const inserted = await client.query(
    `insert into applications (contact_id, opportunity_id, status, submitted_at, reviewed_at, raw_answers, offer_id, intended_cohort_id, source)
     values ($1, $2, $3, $4, $5, $6, $7, $8, 'historical_import') returning id`,
    [
      contactId,
      dealId ?? null,
      status,
      submittedAt,
      reviewedAt ?? null,
      JSON.stringify(rawAnswers ?? {}),
      offerId,
      intendedCohortId ?? null,
    ],
  );
  const applicationId = inserted.rows[0].id;
  await recordProvenance(client, {
    entityTable: "applications",
    entityId: applicationId,
    sourceKey,
    sourceSystem,
    operation: "create",
    batchId,
  });
  return { applicationId, operation: "create" };
}

// ---------------------------------------------------------------------------
// Waitlist Entries — destination collision protection ALREADY exists in
// the schema: waitlist_entries_active_unique_idx, a partial unique index on
// (contact_id, offer_id, coalesce(cohort_id,-1)) WHERE status IN
// ('waiting','invited') — proven live in the Phase 4C rollback test. This
// function still checks historical_import_records first (for the exact-
// retry vs. collision distinction that a bare index violation can't give
// you — a violation just aborts, it doesn't tell you WHY).
// ---------------------------------------------------------------------------

export async function insertHistoricalWaitlistEntry(client, input) {
  const {
    sourceKey,
    sourceSystem,
    batchId,
    contactId,
    offerId,
    cohortId,
    status,
    joinedAt,
    priority,
    notes,
  } = input;

  // joined_at is NOT NULL in the schema and is a live, sorted, formatted
  // UI field. Refuse before issuing any SQL rather than letting a raw
  // constraint violation abort the batch: a missing joined_at means the
  // caller never resolved a real source timestamp for this person, and the
  // fix is to resolve it (or to establish a ruling), never to invent one.
  if (!joinedAt) {
    throw new Error(
      `Refusing to write waitlist_entries for contact ${contactId} / offer ${offerId} (${sourceKey}): joined_at is required and must be a REAL source timestamp — never now(), never a migration-time fallback.`,
    );
  }

  const existingLedger = await client.query(
    `select entity_id from historical_import_records where entity_table = 'waitlist_entries' and source_key = $1`,
    [sourceKey],
  );
  if (existingLedger.rows.length > 0) {
    return {
      waitlistEntryId: existingLedger.rows[0].entity_id,
      operation: "already-imported",
    };
  }

  // Real destination collision check, using the exact same key the live
  // partial unique index enforces — surfaced as a clear application-level
  // error rather than letting a raw constraint violation bubble up.
  const existingActive = await client.query(
    `select id from waitlist_entries where contact_id = $1 and offer_id = $2 and coalesce(cohort_id, -1) = coalesce($3, -1) and status in ('waiting', 'invited')`,
    [contactId, offerId, cohortId ?? null],
  );
  if (existingActive.rows.length > 0) {
    throw new Error(
      `Destination collision: contact ${contactId} already has an active waitlist_entries row for offer ${offerId} (id ${existingActive.rows[0].id}) with no historical_import_records provenance — likely created by live CRM activity since Phase 3. Refusing to duplicate.`,
    );
  }

  // Phase 4L: priority + notes carry the CONFIRMED / APPROXIMATE / UNKNOWN
  // order-confidence distinction (rulings.json's leWaitlistOrderConfidence)
  // without a schema change — priority (nullable, already advisory per
  // 01_tables.sql) holds a real Applied Order value ONLY when one is
  // source-confirmed; notes carries an explicit caveat whenever joined_at
  // is NOT the person's actual known join date (Leif's Approval — see
  // README/rulings.json), so a reader never mistakes the source's batch/
  // data-entry timestamp for a confirmed individual join date. joined_at
  // itself is never null (a live, sorted, formatted UI field) and never
  // now() — always a real source timestamp.
  const inserted = await client.query(
    `insert into waitlist_entries (contact_id, offer_id, cohort_id, status, joined_at, priority, notes)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [
      contactId,
      offerId,
      cohortId ?? null,
      status,
      joinedAt,
      priority ?? null,
      notes ?? null,
    ],
  );
  const waitlistEntryId = inserted.rows[0].id;
  await recordProvenance(client, {
    entityTable: "waitlist_entries",
    entityId: waitlistEntryId,
    sourceKey,
    sourceSystem,
    operation: "create",
    batchId,
  });
  return { waitlistEntryId, operation: "create" };
}

// ---------------------------------------------------------------------------
// Enrollments — destination collision protection ALREADY exists:
// enrollments_opportunity_id_key (UNIQUE on opportunity_id). Migration mode
// must be active for this insert (record_enrollment_status_event() would
// otherwise stamp now() — see the guard in 02_functions.sql).
// ---------------------------------------------------------------------------

export async function insertHistoricalEnrollment(client, input) {
  const {
    sourceKey,
    sourceSystem,
    batchId,
    dealId,
    status,
    startDate,
    endDate,
  } = input;

  const existingLedger = await client.query(
    `select entity_id from historical_import_records where entity_table = 'enrollments' and source_key = $1`,
    [sourceKey],
  );
  if (existingLedger.rows.length > 0) {
    return {
      enrollmentId: existingLedger.rows[0].entity_id,
      operation: "already-imported",
    };
  }

  // The real unique constraint is the actual collision guard here — this
  // check just turns a raw violation into a clear message first.
  const existing = await client.query(
    `select id from enrollments where opportunity_id = $1`,
    [dealId],
  );
  if (existing.rows.length > 0) {
    throw new Error(
      `Destination collision: deal ${dealId} already has an Enrollment (id ${existing.rows[0].id}) with no historical_import_records provenance — likely created by live CRM activity (e.g. a real Won transition) since Phase 3. Refusing to duplicate.`,
    );
  }

  const inserted = await client.query(
    `insert into enrollments (opportunity_id, status, start_date, end_date, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $5) returning id`,
    [
      dealId,
      status,
      startDate ?? null,
      endDate ?? null,
      input.createdAt ?? new Date().toISOString(),
    ],
  );
  const enrollmentId = inserted.rows[0].id;
  await recordProvenance(client, {
    entityTable: "enrollments",
    entityId: enrollmentId,
    sourceKey,
    sourceSystem,
    operation: "create",
    batchId,
  });
  return { enrollmentId, operation: "create" };
}

/**
 * One truthful enrollment_status_events row (record_enrollment_status_event()
 * is suppressed by migration mode — see its guard — because enrollments has
 * no per-status timestamp column of its own to source a truthful entered_at
 * from). Call this exactly once per known historical status, never to invent
 * a fabricated onboarding->active->offboarding->completed chronology.
 */
export async function insertHistoricalEnrollmentStatusEvent(
  client,
  { enrollmentId, status, enteredAt },
) {
  await client.query(
    `insert into enrollment_status_events (enrollment_id, status, entered_at) values ($1, $2, $3)`,
    [enrollmentId, status, enteredAt],
  );
}

// ---------------------------------------------------------------------------
// Acuity — sales_calls and client_sessions. Idempotency key is the REAL,
// ALREADY-EXISTING partial unique index on acuity_appointment_id in both
// tables — deterministic, no historical_import_records needed for these
// two (the Acuity appointment id itself already is the safe, permanent key
// the live webhook trusts).
// ---------------------------------------------------------------------------

export async function insertHistoricalSalesCall(client, input) {
  const {
    contactId,
    dealId,
    acuityAppointmentId,
    acuityAppointmentTypeId,
    scheduledAt,
    attendance,
    source,
  } = input;

  const existing = await client.query(
    `select id from sales_calls where acuity_appointment_id = $1`,
    [acuityAppointmentId],
  );
  if (existing.rows.length > 0) {
    return { salesCallId: existing.rows[0].id, operation: "already-imported" };
  }

  const inserted = await client.query(
    `insert into sales_calls (opportunity_id, contact_id, status, original_scheduled_at, scheduled_at, reschedule_count, attendance, attendance_recorded_at, source, acuity_appointment_id, acuity_appointment_type_id, created_at, updated_at)
     values ($1, $2, 'completed', $3, $3, 0, $4, $3, $5, $6, $7, $3, $3) returning id`,
    [
      dealId ?? null,
      contactId,
      scheduledAt,
      attendance ?? null,
      source ?? "acuity",
      acuityAppointmentId,
      acuityAppointmentTypeId,
    ],
  );
  return { salesCallId: inserted.rows[0].id, operation: "create" };
}

export async function insertHistoricalClientSession(client, input) {
  const {
    contactId,
    enrollmentId,
    offerId,
    acuityAppointmentId,
    acuityAppointmentTypeId,
    scheduledAt,
    status,
  } = input;

  const existing = await client.query(
    `select id from client_sessions where acuity_appointment_id = $1`,
    [acuityAppointmentId],
  );
  if (existing.rows.length > 0) {
    return {
      clientSessionId: existing.rows[0].id,
      operation: "already-imported",
    };
  }

  // client_sessions_status_check now includes 'completed' (Phase 4E schema
  // repair, part of the Approval A package — see 01_tables.sql's own
  // comment for the safety analysis). Requires that migration to have been
  // deployed first; this function does not check for it itself.
  const inserted = await client.query(
    `insert into client_sessions (contact_id, enrollment_id, offer_id, status, scheduled_at, reschedule_count, source, acuity_appointment_id, acuity_appointment_type_id, created_at, updated_at)
     values ($1, $2, $3, $4, $5, 0, 'acuity', $6, $7, $5, $5) returning id`,
    [
      contactId,
      enrollmentId ?? null,
      offerId,
      status ?? "completed",
      scheduledAt,
      acuityAppointmentId,
      acuityAppointmentTypeId,
    ],
  );
  return { clientSessionId: inserted.rows[0].id, operation: "create" };
}

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

export async function recordProvenance(
  client,
  {
    entityTable,
    entityId,
    sourceKey,
    sourceSystem,
    operation,
    batchId,
    evidenceNotes,
  },
) {
  await client.query(
    `insert into historical_import_records (entity_table, entity_id, source_key, source_system, operation, batch_id, evidence_notes)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      entityTable,
      entityId,
      sourceKey,
      sourceSystem,
      operation,
      batchId,
      evidenceNotes ?? null,
    ],
  );
}
