import type { DataProvider } from "ra-core";

import type { Cohort, Offer } from "../types";

export type AcuityAppointmentTypeMapping =
  | { kind: "individual"; offer: Offer }
  // cohort is null when the mapping is durable at the Offer level — one
  // canonical appointment type shared by every Cohort of that group Offer
  // (see the resolver's own comment below for when this applies vs a
  // Cohort-specific mapping).
  | { kind: "group"; offer: Offer; cohort: Cohort | null };

// Durable mapping from an Acuity appointment type to the correct CRM
// Offer/Cohort context, via the stable acuity_appointment_type_id column
// already anticipated on both tables (never a display-name match — Acuity
// only ever sends the type's numeric id in a webhook/appointment payload,
// never its label). A partial unique index on each column (supabase/
// schemas/01_tables.sql) guarantees at most one Offer/Cohort ever claims a
// given appointment type.
//
// GYU real-infrastructure slice, sealing pass: a group Offer CAN carry its
// own acuity_appointment_type_id — this is the correct, durable home for
// one canonical appointment type meant to serve every Cohort of that Offer
// (GYU's real "Let's Meet", 64654501, is exactly this: one appointment
// type for all GYU rounds, not one per Cohort). Matching on the Offer here
// still correctly returns kind "group" (not "individual" — a group Offer
// stays a group Offer regardless of which level its mapping lives at) with
// cohort: null, since the appointment type alone doesn't identify which
// specific Cohort — matchAcuityBooking.ts already handles a null cohort
// correctly (matches by Contact+Offer only, relying on the matched Deal's
// own already-set cohort_id, fixed durably at application time and never
// re-derived from Acuity). A Cohort-level mapping remains available for
// the case a specific round genuinely needs its own separate appointment
// type/calendar (see cohorts.acuity_appointment_type_id's own comment) —
// checked second, so a Cohort-specific mapping always takes precedence
// over a shared Offer-level one for the same appointment type (though the
// partial unique indexes already prevent the same id being claimed twice).
export const resolveOfferCohortForAppointmentType = async (
  dataProvider: DataProvider,
  acuityAppointmentTypeId: string,
): Promise<AcuityAppointmentTypeMapping | null> => {
  const { data: offers } = await dataProvider.getList<Offer>("offers", {
    filter: { acuity_appointment_type_id: acuityAppointmentTypeId },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  if (offers[0]) {
    return offers[0].type === "group"
      ? { kind: "group", offer: offers[0], cohort: null }
      : { kind: "individual", offer: offers[0] };
  }

  const { data: cohorts } = await dataProvider.getList<Cohort>("cohorts", {
    filter: { acuity_appointment_type_id: acuityAppointmentTypeId },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  if (!cohorts[0]) return null;

  const { data: offer } = await dataProvider.getOne<Offer>("offers", {
    id: cohorts[0].offer_id,
  });
  return { kind: "group", offer, cohort: cohorts[0] };
};
