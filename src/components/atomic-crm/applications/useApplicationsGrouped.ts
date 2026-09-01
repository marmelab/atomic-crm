import { useGetList, useGetMany, type Identifier } from "ra-core";

import type { Application, Cohort, Contact, Deal, Offer } from "../types";

export type ApplicationRow = {
  applicationId: Identifier;
  dealId: Identifier;
  contactId: Identifier;
  contactName: string;
  status: Application["status"];
  submittedAt: string;
};

export type IndividualOfferGroup = {
  offer: Offer;
  applications: ApplicationRow[];
};

export type CohortGroup = {
  cohort: Cohort;
  applications: ApplicationRow[];
};

export type GroupOfferGroup = {
  offer: Offer;
  cohorts: CohortGroup[];
};

export type ApplicationGroups = {
  individualGroups: IndividualOfferGroup[];
  groupOfferGroups: GroupOfferGroup[];
};

// Backs the Applications page's Needs Review / Reviewed split (UX cleanup
// pass, §3) over the SAME Offer/1:1 vs Cohort/GYU grouping the page
// already used (Runtime + Visual Consistency slice, §5): real Offer/Cohort
// relationships, not a new Application table or a hand-maintained grouping
// list. An Application with no matching deal/offer (shouldn't happen, but
// data can always be mid-migration) is simply omitted rather than crashing
// the page. "Needs review" is exactly `status === 'pending'` — the same
// vocabulary reviewApplication.ts and applicationConstants.ts already use;
// no new review-state concept introduced.
export const useApplicationsGrouped = (): {
  isPending: boolean;
  needsReview: ApplicationGroups;
  reviewed: ApplicationGroups;
} => {
  const { data: applications, isPending: applicationsPending } =
    useGetList<Application>("applications", {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "submitted_at", order: "DESC" },
    });

  const dealIds = [
    ...new Set((applications ?? []).map((a) => a.opportunity_id)),
  ];
  const { data: deals, isPending: dealsPending } = useGetMany<Deal>(
    "deals",
    { ids: dealIds },
    { enabled: dealIds.length > 0 },
  );

  const offerIds = [...new Set((deals ?? []).map((d) => d.offer_id))];
  const { data: offers, isPending: offersPending } = useGetMany<Offer>(
    "offers",
    { ids: offerIds },
    { enabled: offerIds.length > 0 },
  );

  const cohortIds = [
    ...new Set(
      (deals ?? [])
        .map((d) => d.cohort_id)
        .filter((id): id is Identifier => id != null),
    ),
  ];
  const { data: cohorts, isPending: cohortsPending } = useGetMany<Cohort>(
    "cohorts",
    { ids: cohortIds },
    { enabled: cohortIds.length > 0 },
  );

  const contactIds = [...new Set((deals ?? []).map((d) => d.contact_id))];
  const { data: contacts, isPending: contactsPending } = useGetMany<Contact>(
    "contacts",
    { ids: contactIds },
    { enabled: contactIds.length > 0 },
  );

  const isPending =
    applicationsPending ||
    (dealIds.length > 0 &&
      (dealsPending ||
        (offerIds.length > 0 && offersPending) ||
        (cohortIds.length > 0 && cohortsPending) ||
        (contactIds.length > 0 && contactsPending)));

  const empty: ApplicationGroups = {
    individualGroups: [],
    groupOfferGroups: [],
  };
  if (isPending) {
    return { isPending: true, needsReview: empty, reviewed: empty };
  }

  const dealById = new Map((deals ?? []).map((d) => [String(d.id), d]));
  const offerById = new Map((offers ?? []).map((o) => [String(o.id), o]));
  const contactById = new Map((contacts ?? []).map((c) => [String(c.id), c]));

  const buildGroups = (rows: ApplicationRow[]): ApplicationGroups => {
    const rowsByOfferId = new Map<string, ApplicationRow[]>();
    const rowsByCohortId = new Map<string, ApplicationRow[]>();

    for (const row of rows) {
      const deal = dealById.get(String(row.dealId));
      if (!deal) continue;
      const offer = offerById.get(String(deal.offer_id));
      if (!offer) continue;

      if (offer.type === "individual") {
        const key = String(offer.id);
        rowsByOfferId.set(key, [...(rowsByOfferId.get(key) ?? []), row]);
      } else if (deal.cohort_id != null) {
        const key = String(deal.cohort_id);
        rowsByCohortId.set(key, [...(rowsByCohortId.get(key) ?? []), row]);
      }
    }

    const individualGroups: IndividualOfferGroup[] = (offers ?? [])
      .filter((offer) => offer.type === "individual")
      .map((offer) => ({
        offer,
        applications: rowsByOfferId.get(String(offer.id)) ?? [],
      }))
      .filter((group) => group.applications.length > 0);

    const groupOfferGroups: GroupOfferGroup[] = (offers ?? [])
      .filter((offer) => offer.type === "group")
      .map((offer) => ({
        offer,
        cohorts: (cohorts ?? [])
          .filter((cohort) => String(cohort.offer_id) === String(offer.id))
          .map((cohort) => ({
            cohort,
            applications: rowsByCohortId.get(String(cohort.id)) ?? [],
          }))
          .filter((cohortGroup) => cohortGroup.applications.length > 0),
      }))
      .filter((group) => group.cohorts.length > 0);

    return { individualGroups, groupOfferGroups };
  };

  const needsReviewRows: ApplicationRow[] = [];
  const reviewedRows: ApplicationRow[] = [];

  for (const application of applications ?? []) {
    const deal = dealById.get(String(application.opportunity_id));
    if (!deal) continue;
    const offer = offerById.get(String(deal.offer_id));
    if (!offer) continue;
    const contact = contactById.get(String(deal.contact_id));

    const row: ApplicationRow = {
      applicationId: application.id,
      dealId: deal.id,
      contactId: deal.contact_id,
      contactName: contact
        ? `${contact.first_name} ${contact.last_name}`
        : deal.name,
      status: application.status,
      submittedAt: application.submitted_at,
    };

    (application.status === "pending" ? needsReviewRows : reviewedRows).push(
      row,
    );
  }

  return {
    isPending: false,
    needsReview: buildGroups(needsReviewRows),
    reviewed: buildGroups(reviewedRows),
  };
};
