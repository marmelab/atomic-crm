import { useGetList, useGetMany, type Identifier } from "ra-core";

import type { Application, Cohort, Contact, Offer } from "../types";

// The 159 imported Applications, which the Applications page could not show
// at all: useApplicationsGrouped filters the WHOLE page to
// source = 'public_form', so with every Application imported the page read
// "No applications yet" while production held 159 of them.
//
// That filter is right for Needs Review — a back-filled record of something
// that already happened is not present-day review work — and stays exactly
// as it is. This hook is the other half: the same records, browsable as
// history.
//
// Two things make this NOT a copy of useApplicationsGrouped:
//   - It resolves Offer and Cohort from the APPLICATION's own offer_id /
//     intended_cohort_id, so the 88 imported Applications with no
//     Opportunity still appear. Grouping via the Deal drops every one of
//     them, because there is no Deal to read an offer off.
//   - It never contributes to any review queue or count.

export type HistoricalApplicationRow = {
  applicationId: Identifier;
  contactId: Identifier;
  contactName: string;
  status: Application["status"];
  submittedAt: string;
  // A historical Application with no Opportunity is a real and common
  // shape, not a broken row — surfaced so the UI can say so plainly.
  hasOpportunity: boolean;
  opportunityId: Identifier | null;
};

export type HistoricalApplicationGroup = {
  key: string;
  offer: Offer | undefined;
  cohort: Cohort | undefined;
  label: string;
  applications: HistoricalApplicationRow[];
};

export const useHistoricalApplications = (): {
  isPending: boolean;
  total: number;
  groups: HistoricalApplicationGroup[];
} => {
  const { data: applications, isPending: applicationsPending } =
    useGetList<Application>("applications", {
      // No filter: partitioned below on source instead. A "not equal"
      // operator is not mapped by the FakeRest adapter (see AGENTS.md on
      // filter operators), so filtering here would work against Supabase
      // and silently return nothing in the demo/test provider.
      filter: {},
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "submitted_at", order: "DESC" },
    });

  // Imported records only. A live public-form submission is present-day
  // review work and belongs to useApplicationsGrouped, never to history.
  const historical = (applications ?? []).filter(
    (application) => application.source !== "public_form",
  );

  const contactIds = [...new Set(historical.map((a) => a.contact_id))].filter(
    (id): id is Identifier => id != null,
  );
  const { data: contacts, isPending: contactsPending } = useGetMany<Contact>(
    "contacts",
    { ids: contactIds },
    { enabled: contactIds.length > 0 },
  );

  const { data: offers, isPending: offersPending } = useGetList<Offer>(
    "offers",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    },
  );
  const { data: cohorts, isPending: cohortsPending } = useGetList<Cohort>(
    "cohorts",
    {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "id", order: "ASC" },
    },
  );

  const isPending =
    applicationsPending ||
    offersPending ||
    cohortsPending ||
    (contactIds.length > 0 && contactsPending);

  if (isPending) return { isPending: true, total: 0, groups: [] };

  const contactById = new Map((contacts ?? []).map((c) => [String(c.id), c]));
  const offerById = new Map((offers ?? []).map((o) => [String(o.id), o]));
  const cohortById = new Map((cohorts ?? []).map((c) => [String(c.id), c]));

  const byKey = new Map<string, HistoricalApplicationGroup>();

  for (const application of historical) {
    const offer =
      application.offer_id != null
        ? offerById.get(String(application.offer_id))
        : undefined;
    const cohort =
      application.intended_cohort_id != null
        ? cohortById.get(String(application.intended_cohort_id))
        : undefined;
    const contact = contactById.get(String(application.contact_id));

    // Cohort-specific intent groups under that cohort; otherwise under the
    // Offer. An Application whose Offer cannot be resolved still gets a
    // group rather than disappearing — losing a real record to a lookup
    // miss is worse than an "Unassigned" heading.
    const key = cohort
      ? `cohort:${cohort.id}`
      : offer
        ? `offer:${offer.id}`
        : "unassigned";
    const label = cohort?.name ?? offer?.name ?? "Program not recorded";

    const group = byKey.get(key) ?? {
      key,
      offer,
      cohort,
      label,
      applications: [],
    };
    group.applications.push({
      applicationId: application.id,
      contactId: application.contact_id,
      contactName: contact
        ? `${contact.first_name} ${contact.last_name}`
        : "Contact not found",
      status: application.status,
      submittedAt: application.submitted_at,
      hasOpportunity: application.opportunity_id != null,
      opportunityId: application.opportunity_id ?? null,
    });
    byKey.set(key, group);
  }

  const groups = [...byKey.values()].sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  return {
    isPending: false,
    total: historical.length,
    groups,
  };
};
