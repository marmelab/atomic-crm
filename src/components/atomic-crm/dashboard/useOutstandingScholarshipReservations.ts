import { useGetList, useGetMany } from "ra-core";
import type { Identifier } from "ra-core";

import type { Contact, Deal, Offer, ScholarshipSlot } from "../types";

export type OutstandingScholarshipReservationRow = {
  dealId: Identifier;
  offerName: string;
  contactName: string;
};

// Scholarship Pricing + Capacity slice: the small operational Dashboard
// surface for the ONE risk the locked "no TTL, no automatic expiration"
// reservation design deliberately accepts — an unpaid scholarship grant
// that sits outstanding indefinitely until Leif explicitly releases it.
// Deliberately narrow (per Leif's own instruction): only outstanding
// (Deal-held, unpaid) reservations — a CURRENT scholarship Enrollment is
// already visible everywhere Enrollments normally are, so duplicating it
// here would turn this into the "scholarship-management subsystem" this
// slice explicitly does not want to build.
export const useOutstandingScholarshipReservations = (): {
  isPending: boolean;
  rows: OutstandingScholarshipReservationRow[];
} => {
  const { data: slots, isPending: slotsPending } = useGetList<ScholarshipSlot>(
    "scholarship_slots",
    {
      filter: {},
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    },
  );

  const outstanding = (slots ?? []).filter(
    (slot) => slot.holder_deal_id != null,
  );
  const dealIds = outstanding.map((slot) => slot.holder_deal_id!);
  const { data: deals, isPending: dealsPending } = useGetMany<Deal>(
    "deals",
    { ids: dealIds },
    { enabled: dealIds.length > 0 },
  );

  const offerIds = [...new Set((deals ?? []).map((deal) => deal.offer_id))];
  const { data: offers, isPending: offersPending } = useGetMany<Offer>(
    "offers",
    { ids: offerIds },
    { enabled: offerIds.length > 0 },
  );

  const contactIds = [
    ...new Set(
      (deals ?? [])
        .map((deal) => deal.contact_id)
        .filter((id): id is Identifier => id != null),
    ),
  ];
  const { data: contacts, isPending: contactsPending } = useGetMany<Contact>(
    "contacts",
    { ids: contactIds },
    { enabled: contactIds.length > 0 },
  );

  const isPending =
    slotsPending ||
    (dealIds.length > 0 && dealsPending) ||
    (offerIds.length > 0 && offersPending) ||
    (contactIds.length > 0 && contactsPending);

  if (isPending) return { isPending: true, rows: [] };

  const dealById = new Map(
    (deals ?? []).map((deal) => [String(deal.id), deal]),
  );
  const offerById = new Map(
    (offers ?? []).map((offer) => [String(offer.id), offer]),
  );
  const contactById = new Map(
    (contacts ?? []).map((contact) => [String(contact.id), contact]),
  );

  const rows: OutstandingScholarshipReservationRow[] = outstanding
    .map((slot) => {
      const deal = dealById.get(String(slot.holder_deal_id));
      const contact = deal?.contact_id
        ? contactById.get(String(deal.contact_id))
        : undefined;
      const offer = deal ? offerById.get(String(deal.offer_id)) : undefined;
      return {
        dealId: slot.holder_deal_id!,
        offerName: offer?.name ?? deal?.offer_name_snapshot ?? "",
        contactName: contact
          ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
          : (deal?.name ?? ""),
      };
    })
    // A deal that no longer exists (unlikely — a slot always keeps its
    // holder consistent, but stay defensive) never renders a broken row.
    .filter((row) => dealById.has(String(row.dealId)));

  return { isPending: false, rows };
};
