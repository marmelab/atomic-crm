import type { DataProvider } from "ra-core";

import type { Cohort, Offer } from "../types";
import { getDenverDateString } from "../dashboard/artOracle/selectDailyArtwork";

// The public form's read-side context: only the handful of fields an
// applicant is allowed to see (name, whether applications are open) —
// never internal ids beyond what's needed to submit, sales data, or other
// applicants (§15). FakeRest-backed dev/demo implementation; the
// production path is the same GET operation on
// supabase/functions/public_application/index.ts (RLS blocks an anon
// client from reading "offers"/"cohorts" directly — see that file's
// header).
export type PublicOfferContext =
  | {
      kind: "individual";
      offerId: number | string;
      offerName: string;
      isAccepting: true;
    }
  | {
      kind: "group-open";
      offerId: number | string;
      offerName: string;
      cohortId: number | string;
      cohortName: string;
      isAccepting: true;
    }
  | { kind: "group-closed"; offerName: string; cohortName: string }
  | { kind: "not-found" };

// The Living Example (or any future 1:1 Offer) is discovered the same way
// dashboard/useComingUpItems.ts and dashboard/useLivingExampleCapacityData.ts
// already do: the individual Offer with a capacity ceiling, never a
// hardcoded id/name.
export const getLivingExampleOfferContext = async (
  dataProvider: DataProvider,
): Promise<PublicOfferContext> => {
  const { data: offers } = await dataProvider.getList<Offer>("offers", {
    filter: { type: "individual" },
    pagination: { page: 1, perPage: 10 },
    sort: { field: "id", order: "ASC" },
  });
  const offer = offers.find(
    (candidate) => candidate.max_active_clients != null && candidate.is_active,
  );
  if (!offer) return { kind: "not-found" };
  return {
    kind: "individual",
    offerId: offer.id,
    offerName: offer.name,
    isAccepting: true,
  };
};

export const getGroupCohortContext = async (
  dataProvider: DataProvider,
  cohortId: string,
): Promise<PublicOfferContext> => {
  const cohort = await dataProvider
    .getOne<Cohort>("cohorts", { id: cohortId })
    .then(({ data }) => data)
    .catch(() => null);
  if (!cohort) return { kind: "not-found" };

  const offer = await dataProvider
    .getOne<Offer>("offers", { id: cohort.offer_id })
    .then(({ data }) => data)
    .catch(() => null);
  if (!offer || !offer.is_active || offer.type !== "group") {
    return { kind: "not-found" };
  }

  const today = getDenverDateString();
  const isAccepting =
    cohort.status === "applications_open" &&
    (!cohort.applications_open_at || today >= cohort.applications_open_at) &&
    (!cohort.applications_close_at || today <= cohort.applications_close_at);

  if (!isAccepting) {
    return {
      kind: "group-closed",
      offerName: offer.name,
      cohortName: cohort.name,
    };
  }
  return {
    kind: "group-open",
    offerId: offer.id,
    offerName: offer.name,
    cohortId: cohort.id,
    cohortName: cohort.name,
    isAccepting: true,
  };
};
