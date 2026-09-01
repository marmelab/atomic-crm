import type { DataProvider } from "ra-core";

import type { Cohort, Offer } from "../types";

export type AcuityAppointmentTypeMapping =
  | { kind: "individual"; offer: Offer }
  | { kind: "group"; offer: Offer; cohort: Cohort };

// Durable mapping from an Acuity appointment type to the correct CRM
// Offer/Cohort context, via the stable acuity_appointment_type_id column
// already anticipated on both tables (never a display-name match — Acuity
// only ever sends the type's numeric id in a webhook/appointment payload,
// never its label). A partial unique index on each column (supabase/
// schemas/01_tables.sql) guarantees at most one Offer/Cohort ever claims a
// given appointment type, so "individual" and "group" here are mutually
// exclusive by construction.
export const resolveOfferCohortForAppointmentType = async (
  dataProvider: DataProvider,
  acuityAppointmentTypeId: string,
): Promise<AcuityAppointmentTypeMapping | null> => {
  const { data: offers } = await dataProvider.getList<Offer>("offers", {
    filter: { acuity_appointment_type_id: acuityAppointmentTypeId },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  if (offers[0]) return { kind: "individual", offer: offers[0] };

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
