import { useGetList, useGetMany, type Identifier } from "ra-core";

import type { Cohort, Offer, WaitlistEntry } from "../types";

export type ContactWaitlistRow = {
  entryId: Identifier;
  offerId: Identifier;
  offerName: string;
  cohortId: Identifier | null;
  cohortName: string | null;
  status: WaitlistEntry["status"];
  joinedAt: string;
  desiredTiming: string | null;
  invitedAt: string | null;
  convertedAt: string | null;
  convertedOpportunityId: Identifier | null;
  removedAt: string | null;
  programPath: string;
};

// Backs ContactShow's "Waitlists" section (Waitlists slice, §10): the
// Contact's full lifetime history — active AND historical (converted/
// removed) — since a past relationship stays visible even after it ends,
// same principle as Opportunities already showing on a Contact regardless
// of stage/outcome.
export const useContactWaitlists = (contactId?: Identifier) => {
  const { data: entries, isPending: entriesPending } =
    useGetList<WaitlistEntry>(
      "waitlist_entries",
      {
        filter: { contact_id: contactId },
        pagination: { page: 1, perPage: 100 },
        sort: { field: "joined_at", order: "DESC" },
      },
      { enabled: contactId != null },
    );

  const offerIds = [...new Set((entries ?? []).map((entry) => entry.offer_id))];
  const { data: offers, isPending: offersPending } = useGetMany<Offer>(
    "offers",
    { ids: offerIds },
    { enabled: offerIds.length > 0 },
  );

  const cohortIds = [
    ...new Set(
      (entries ?? [])
        .map((entry) => entry.cohort_id)
        .filter((id): id is Identifier => id != null),
    ),
  ];
  const { data: cohorts, isPending: cohortsPending } = useGetMany<Cohort>(
    "cohorts",
    { ids: cohortIds },
    { enabled: cohortIds.length > 0 },
  );

  const isPending =
    entriesPending ||
    (offerIds.length > 0 && offersPending) ||
    (cohortIds.length > 0 && cohortsPending);

  if (isPending) {
    return { isPending: true, entries: [] as ContactWaitlistRow[] };
  }

  const offerById = new Map((offers ?? []).map((o) => [String(o.id), o]));
  const cohortById = new Map((cohorts ?? []).map((c) => [String(c.id), c]));

  const rows: ContactWaitlistRow[] = (entries ?? []).map((entry) => {
    const offer = offerById.get(String(entry.offer_id));
    const cohort =
      entry.cohort_id != null
        ? cohortById.get(String(entry.cohort_id))
        : undefined;

    return {
      entryId: entry.id,
      offerId: entry.offer_id,
      offerName: offer?.name ?? "",
      cohortId: entry.cohort_id ?? null,
      cohortName: cohort?.name ?? null,
      status: entry.status,
      joinedAt: entry.joined_at,
      desiredTiming: entry.desired_timing ?? null,
      invitedAt: entry.invited_at ?? null,
      convertedAt: entry.converted_at ?? null,
      convertedOpportunityId: entry.converted_opportunity_id ?? null,
      removedAt: entry.removed_at ?? null,
      programPath: cohort
        ? `/cohorts/${cohort.id}/show`
        : offer?.type === "individual"
          ? `/programs/individual/${entry.offer_id}`
          : `/programs/group/${entry.offer_id}`,
    };
  });

  return { isPending: false, entries: rows };
};
