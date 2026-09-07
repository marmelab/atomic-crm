import type { DataProvider } from "ra-core";

import type { Offer } from "../types";

// Durable mapping from an Acuity appointment type to the Offer whose PAID
// CLIENT SESSIONS it represents — e.g. The Living Example's real "Zoom
// 1:1", 90522599. Deliberately separate from sales-calls/
// offerCohortAcuityMapping.ts's resolver: that one maps a SALES CALL
// appointment type (a prospect deciding whether to buy); this one maps an
// already-enrolled client's recurring session. The two must never be
// confused merely because they can share a Contact/Offer — structurally
// impossible here since each reads its own distinct column
// (client_session_acuity_appointment_type_id vs
// acuity_appointment_type_id), enforced unique by its own partial index
// (supabase/schemas/01_tables.sql).
//
// Offer-level only in this slice (no Cohort-level session mapping — group-
// offer/cohort session attendance is explicitly out of scope for Client +
// Session Operations Slice A).
export const resolveOfferForClientSessionAppointmentType = async (
  dataProvider: DataProvider,
  acuityAppointmentTypeId: string,
): Promise<Offer | null> => {
  const { data: offers } = await dataProvider.getList<Offer>("offers", {
    filter: {
      client_session_acuity_appointment_type_id: acuityAppointmentTypeId,
    },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  return offers[0] ?? null;
};
