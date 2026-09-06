import type { DataProvider, Identifier } from "ra-core";

import type { Cohort, Contact, Deal, Offer } from "../types";
import { normalizeEmail } from "../public-application/submitApplication";
import { resolveOfferCohortForAppointmentType } from "./offerCohortAcuityMapping";

// Same active-pipeline definition used throughout this app (waitlist/
// waitlistActions.ts, public-application/submitApplication.ts) — duplicated
// per those modules' own documented convention rather than imported from a
// private helper.
const isActiveDeal = (deal: Pick<Deal, "stage" | "outcome" | "archived_at">) =>
  deal.archived_at == null && deal.stage !== "won" && deal.outcome == null;

// Normalized-email match-or-create, the exact matching principle Native
// Application Intake established (§5 there) — no name-only fallback.
// Existing Contact data is never overwritten, only last_seen touched.
const findOrCreateContact = async (
  dataProvider: DataProvider,
  {
    firstName,
    lastName,
    email,
  }: {
    firstName: string;
    lastName: string;
    email: string;
  },
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

export type OpportunityMatchResult =
  | { kind: "matched"; opportunity: Deal }
  | { kind: "none" }
  | { kind: "ambiguous" };

// The Contact's own active Opportunities compatible with a given Offer/
// Cohort mapping — "compatible" mirrors the exact appointment-type mapping
// rule (never attach across Offers merely because it's the same Contact).
// Unmatched Sales Call Resolution slice: also the candidate list the
// resolution UI's "Attach to Existing Opportunity" picker shows, so an
// incompatible Opportunity (e.g. a GYU one for an LE booking) is
// structurally impossible to select — it's just never in the list.
export const findCompatibleActiveOpportunities = async (
  dataProvider: DataProvider,
  {
    contactId,
    offerId,
    cohortId,
  }: {
    contactId: Identifier;
    offerId: Identifier;
    cohortId: Identifier | null;
  },
): Promise<Deal[]> => {
  const { data: deals } = await dataProvider.getList<Deal>("deals", {
    filter: {
      contact_id: contactId,
      offer_id: offerId,
      ...(cohortId != null ? { cohort_id: cohortId } : {}),
    },
    pagination: { page: 1, perPage: 100 },
    sort: { field: "id", order: "ASC" },
  });
  return deals.filter(isActiveDeal);
};

// "Find the appropriate active Opportunity for the booked offer/cohort" —
// never guessed. Zero matches or more than one both come back as
// unresolved rather than picking one; the caller preserves the booking
// with opportunity_id = null (Decision 3) instead of silently attaching it
// to an ambiguous Opportunity.
export const findActiveOpportunityMatch = async (
  dataProvider: DataProvider,
  args: {
    contactId: Identifier;
    offerId: Identifier;
    cohortId: Identifier | null;
  },
): Promise<OpportunityMatchResult> => {
  const active = await findCompatibleActiveOpportunities(dataProvider, args);
  if (active.length === 0) return { kind: "none" };
  if (active.length > 1) return { kind: "ambiguous" };
  return { kind: "matched", opportunity: active[0] };
};

export type MatchAcuityBookingResult =
  | {
      status: "matched";
      contact: Contact;
      opportunity: Deal;
      offer: Offer;
      cohort: Cohort | null;
    }
  | {
      status: "unmatched-opportunity";
      contact: Contact;
      offer: Offer;
      cohort: Cohort | null;
      reason: "none" | "ambiguous";
    }
  // Do not fabricate a match: an Acuity appointment type nobody has mapped
  // to an Offer/Cohort yet is a configuration gap, not a Contact/booking
  // problem — no Contact is even looked up, so nothing is created.
  | { status: "unknown-appointment-type" };

// Identity + intended-sales-process resolution for one incoming Acuity
// booking (Acuity/Sales Call Lifecycle slice). Contact resolution always
// succeeds (find-or-create); Opportunity resolution can come back
// unresolved — see findActiveOpportunityMatch above.
export const matchAcuityBooking = async (
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
): Promise<MatchAcuityBookingResult> => {
  const mapping = await resolveOfferCohortForAppointmentType(
    dataProvider,
    acuityAppointmentTypeId,
  );
  if (!mapping) return { status: "unknown-appointment-type" };

  const contact = await findOrCreateContact(dataProvider, {
    firstName,
    lastName,
    email,
  });
  const cohort = mapping.kind === "group" ? mapping.cohort : null;

  const match = await findActiveOpportunityMatch(dataProvider, {
    contactId: contact.id,
    offerId: mapping.offer.id,
    cohortId: cohort?.id ?? null,
  });

  if (match.kind === "matched") {
    return {
      status: "matched",
      contact,
      opportunity: match.opportunity,
      offer: mapping.offer,
      cohort,
    };
  }
  return {
    status: "unmatched-opportunity",
    contact,
    offer: mapping.offer,
    cohort,
    reason: match.kind === "ambiguous" ? "ambiguous" : "none",
  };
};
