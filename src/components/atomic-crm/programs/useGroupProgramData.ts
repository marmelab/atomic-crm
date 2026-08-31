import { useGetList, useGetOne, type Identifier } from "ra-core";

import type { Cohort, Offer } from "../types";

// Backs the Group Program page (Waitlists slice, §8 — the "GYU program-
// level" home that didn't exist before this slice): the Offer itself plus
// its Cohorts, for any group Offer, not hardcoded to Growing Yourself Up.
export const useGroupProgramData = (offerId?: Identifier) => {
  const { data: offer, isPending: offerPending } = useGetOne<Offer>(
    "offers",
    { id: offerId! },
    { enabled: offerId != null },
  );

  const { data: cohorts, isPending: cohortsPending } = useGetList<Cohort>(
    "cohorts",
    {
      filter: { offer_id: offerId, "status@neq": "completed" },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "program_start_at", order: "ASC" },
    },
    { enabled: offerId != null },
  );

  const isPending = offerPending || (offerId != null && cohortsPending);

  return {
    isPending,
    offer: offer ?? null,
    cohorts: cohorts ?? [],
  };
};
