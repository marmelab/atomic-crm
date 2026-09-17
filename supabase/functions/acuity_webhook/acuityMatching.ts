import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

// Live Acuity Connection slice. Mirrors (does not share code with — Deno
// Edge Functions can't import from src/) src/components/atomic-crm/
// sales-calls/offerCohortAcuityMapping.ts + matchAcuityBooking.ts, the
// fixture-tested "logic of record" for this same matching behavior.

export type OfferRow = {
  id: number;
  name: string;
  type: "individual" | "group";
  acuity_appointment_type_id: string | null;
};
export type CohortRow = {
  id: number;
  name: string;
  offer_id: number;
  acuity_appointment_type_id: string | null;
};
export type ContactRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email_jsonb: { email: string; type: string }[] | null;
};
export type DealRow = {
  id: number;
  contact_id: number;
  offer_id: number;
  cohort_id: number | null;
  stage: string;
  outcome: string | null;
  archived_at: string | null;
};

export const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

const isActiveDeal = (
  deal: Pick<DealRow, "stage" | "outcome" | "archived_at">,
) => deal.archived_at == null && deal.stage !== "won" && deal.outcome == null;

// Stable Acuity appointment-type ID -> Offer/Cohort, never a display-name
// match (Acuity only ever sends the type's numeric id). A partial unique
// index on each column (supabase/schemas/01_tables.sql) guarantees at most
// one Offer/Cohort ever claims a given appointment type.
export type AppointmentMeaning = {
  offer: OfferRow;
  cohort: CohortRow | null;
  kind: "sales_call" | "client_session";
};

// What a booking on this appointment type MEANT on the day it was booked.
//
// Reads the effective-dated map (resolve_acuity_appointment_type) rather
// than offers.acuity_appointment_type_id, because an appointment type does
// not mean one thing forever: 64654501 is called "Growing Yourself Up"
// today, and the same type carried Leif's earlier 1:1 coaching in
// 2024-2025. Resolving a 2025 booking through today's name would invent a
// GYU sales history that never happened.
//
// FAILS CLOSED. Returns null when the map has no period for that date
// (a gap) and when the period exists but is explicitly undetermined —
// there is an interval on 64654501 where nothing establishes the meaning,
// and a booking landing there must be left for a human rather than
// guessed at.
export const resolveOfferCohort = async (
  appointmentTypeId: string,
  onDate: string,
): Promise<AppointmentMeaning | null> => {
  const { data, error } = await supabaseAdmin.rpc(
    "resolve_acuity_appointment_type",
    { p_appointment_type_id: appointmentTypeId, p_on: onDate },
  );
  if (error) {
    console.error("acuity: appointment-type resolution failed", error.message);
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        offer_id: number | null;
        offer_name: string | null;
        kind: string;
        cohort_id: number | null;
        resolution: string;
      }
    | undefined;
  if (!row || row.resolution !== "mapped" || row.offer_id == null) return null;

  const { data: offer } = await supabaseAdmin
    .from("offers")
    .select("id, name, type, acuity_appointment_type_id")
    .eq("id", row.offer_id)
    .maybeSingle();
  if (!offer) return null;

  let cohort: CohortRow | null = null;
  if (row.cohort_id != null) {
    const { data: found } = await supabaseAdmin
      .from("cohorts")
      .select("id, name, offer_id, acuity_appointment_type_id")
      .eq("id", row.cohort_id)
      .maybeSingle();
    cohort = (found as CohortRow) ?? null;
  }

  return {
    offer: offer as OfferRow,
    cohort,
    kind: row.kind === "client_session" ? "client_session" : "sales_call",
  };
};

// Normalized-email match-or-create, the same principle Native Application
// Intake established — no name-only fallback, and capitalization/
// incidental formatting differences never create a duplicate Contact.
// Existing Contact data is never overwritten, only last_seen touched.
export const findOrCreateContact = async (params: {
  firstName: string;
  lastName: string;
  email: string;
}): Promise<ContactRow> => {
  const normalized = normalizeEmail(params.email);
  const { data: contacts } = await supabaseAdmin
    .from("contacts")
    .select("id, first_name, last_name, email_jsonb");
  const existing = ((contacts ?? []) as ContactRow[]).find((contact) =>
    (contact.email_jsonb ?? []).some(
      (entry) => entry.email && normalizeEmail(entry.email) === normalized,
    ),
  );
  if (existing) {
    await supabaseAdmin
      .from("contacts")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", existing.id);
    return existing;
  }

  const { data: created, error } = await supabaseAdmin
    .from("contacts")
    .insert({
      first_name: params.firstName,
      last_name: params.lastName,
      email_jsonb: [{ email: normalized, type: "Other" }],
      phone_jsonb: [],
      tags: [],
      has_newsletter: false,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      sales_eligibility: "normal",
    })
    .select("id, first_name, last_name, email_jsonb")
    .single();
  if (error || !created)
    throw new Error(error?.message ?? "Failed to create contact");
  return created as ContactRow;
};

// Never guessed: zero matches or more than one both come back unresolved
// (deal: null) rather than picking one — the caller preserves the booking
// with opportunity_id = null instead of silently attaching it to the
// wrong (or an ambiguous) Opportunity.
export const findActiveOpportunity = async (params: {
  contactId: number;
  offerId: number;
  cohortId: number | null;
}): Promise<{ deal: DealRow | null; ambiguous: boolean }> => {
  let query = supabaseAdmin
    .from("deals")
    .select("id, contact_id, offer_id, cohort_id, stage, outcome, archived_at")
    .eq("contact_id", params.contactId)
    .eq("offer_id", params.offerId);
  query =
    params.cohortId != null ? query.eq("cohort_id", params.cohortId) : query;
  const { data } = await query;
  const active = ((data ?? []) as DealRow[]).filter(isActiveDeal);
  if (active.length === 0) return { deal: null, ambiguous: false };
  if (active.length > 1) return { deal: null, ambiguous: true };
  return { deal: active[0], ambiguous: false };
};
