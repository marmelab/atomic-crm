import type { DataProvider } from "ra-core";

import type { Contact, Enrollment, Offer } from "../types";
import { normalizeEmail } from "../public-application/submitApplication";
import { resolveOfferForClientSessionAppointmentType } from "./clientSessionAcuityMapping";
import { matchClientSessionEnrollment } from "./matchClientSessionEnrollment";

// Normalized-email match-or-create — same matching principle as Native
// Application Intake / sales-calls/matchAcuityBooking.ts's own
// findOrCreateContact, duplicated per this codebase's documented
// convention (small independent modules over a shared private helper).
// Existing Contact data is never overwritten, only last_seen touched. In
// practice an already-enrolled paying client will almost always already
// exist as a Contact — this exists for the rare/anomalous case rather than
// assuming it.
const findOrCreateContact = async (
  dataProvider: DataProvider,
  {
    firstName,
    lastName,
    email,
  }: { firstName: string; lastName: string; email: string },
): Promise<Contact> => {
  const normalized = normalizeEmail(email);
  const { data: contacts } = await dataProvider.getList<Contact>("contacts", {
    filter: {},
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "id", order: "ASC" },
  });
  const existing = contacts.find((contact) =>
    (contact.email_jsonb ?? []).some(
      (entry) => entry.email && normalizeEmail(entry.email) === normalized,
    ),
  );
  if (existing) {
    await dataProvider.update("contacts", {
      id: existing.id,
      data: { last_seen: new Date().toISOString() },
      previousData: existing,
    });
    return existing;
  }

  const { data: created } = await dataProvider.create<Contact>("contacts", {
    data: {
      first_name: firstName,
      last_name: lastName,
      email_jsonb: [{ email: normalized, type: "Other" }],
      phone_jsonb: [],
      tags: [],
      has_newsletter: false,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      sales_eligibility: "normal",
    },
  });
  return created;
};

export type MatchClientSessionAppointmentResult =
  | {
      status: "matched";
      contact: Contact;
      offer: Offer;
      enrollment: Enrollment;
    }
  | {
      status: "unmatched-enrollment";
      contact: Contact;
      offer: Offer;
      reason: "none" | "ambiguous";
    }
  // The appointment type isn't mapped to any Offer's paid-client-session
  // config yet — a configuration gap, not a Contact/booking problem. No
  // Contact is even looked up, matching matchAcuityBooking.ts's own
  // "unknown-appointment-type" precedent.
  | { status: "unknown-appointment-type" };

// Identity + Enrollment resolution for one incoming paid-client-session
// Acuity booking. Contact resolution always succeeds (find-or-create);
// Enrollment resolution can come back unresolved — see
// matchClientSessionEnrollment.ts above. Never creates or mutates an
// Opportunity/Enrollment — this is read-only matching against what
// already exists.
export const matchClientSessionAppointment = async (
  dataProvider: DataProvider,
  {
    email,
    firstName,
    lastName,
    acuityAppointmentTypeId,
  }: {
    email: string;
    firstName: string;
    lastName: string;
    acuityAppointmentTypeId: string;
  },
): Promise<MatchClientSessionAppointmentResult> => {
  const offer = await resolveOfferForClientSessionAppointmentType(
    dataProvider,
    acuityAppointmentTypeId,
  );
  if (!offer) return { status: "unknown-appointment-type" };

  const contact = await findOrCreateContact(dataProvider, {
    firstName,
    lastName,
    email,
  });

  const match = await matchClientSessionEnrollment(dataProvider, {
    contactId: contact.id,
    offerId: offer.id,
  });

  if (match.kind === "matched") {
    return { status: "matched", contact, offer, enrollment: match.enrollment };
  }
  return {
    status: "unmatched-enrollment",
    contact,
    offer,
    reason: match.kind === "ambiguous" ? "ambiguous" : "none",
  };
};
