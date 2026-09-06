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
export const resolveOfferCohort = async (
  appointmentTypeId: string,
): Promise<{ offer: OfferRow; cohort: CohortRow | null } | null> => {
  const { data: offers } = await supabaseAdmin
    .from("offers")
    .select("id, name, type, acuity_appointment_type_id")
    .eq("acuity_appointment_type_id", appointmentTypeId)
    .limit(1);
  if (offers && offers.length > 0) {
    return { offer: offers[0] as OfferRow, cohort: null };
  }

  const { data: cohorts } = await supabaseAdmin
    .from("cohorts")
    .select("id, name, offer_id, acuity_appointment_type_id")
    .eq("acuity_appointment_type_id", appointmentTypeId)
    .limit(1);
  if (!cohorts || cohorts.length === 0) return null;
  const cohort = cohorts[0] as CohortRow;

  const { data: offer } = await supabaseAdmin
    .from("offers")
    .select("id, name, type, acuity_appointment_type_id")
    .eq("id", cohort.offer_id)
    .maybeSingle();
  if (!offer) return null;
  return { offer: offer as OfferRow, cohort };
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
