import { useGetList, useGetMany } from "ra-core";
import type { Identifier } from "ra-core";

import type { Cohort, Deal, Enrollment, Offer } from "../types";

export type ClientRow = {
  enrollment: Enrollment;
  contactId: Identifier | undefined;
  offer: Offer | undefined;
  cohort: Cohort | undefined;
};

// Backs the Clients (/enrollments) list's Needs Onboarding / Active / Past
// split (architecture review, §9) — same underlying `enrollments` resource,
// purely a presentational regroup, mirroring the exact precedent
// applications/useApplicationsGrouped.ts already established for
// Applications' own Needs Review / Reviewed split.
export const useClientsGrouped = (): {
  isPending: boolean;
  needsOnboarding: ClientRow[];
  active: ClientRow[];
  past: ClientRow[];
} => {
  const { data: enrollments, isPending: enrollmentsPending } =
    useGetList<Enrollment>("enrollments", {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "created_at", order: "DESC" },
    });

  const dealIds = [
    ...new Set((enrollments ?? []).map((e) => e.opportunity_id)),
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

  const isPending =
    enrollmentsPending ||
    (dealIds.length > 0 &&
      (dealsPending ||
        (offerIds.length > 0 && offersPending) ||
        (cohortIds.length > 0 && cohortsPending)));

  if (isPending) {
    return { isPending: true, needsOnboarding: [], active: [], past: [] };
  }

  const dealById = new Map((deals ?? []).map((d) => [String(d.id), d]));
  const offerById = new Map((offers ?? []).map((o) => [String(o.id), o]));
  const cohortById = new Map((cohorts ?? []).map((c) => [String(c.id), c]));

  const needsOnboarding: ClientRow[] = [];
  const active: ClientRow[] = [];
  const past: ClientRow[] = [];

  for (const enrollment of enrollments ?? []) {
    const deal = dealById.get(String(enrollment.opportunity_id));
    const row: ClientRow = {
      enrollment,
      contactId: deal?.contact_id ?? undefined,
      offer: deal ? offerById.get(String(deal.offer_id)) : undefined,
      cohort:
        deal?.cohort_id != null
          ? cohortById.get(String(deal.cohort_id))
          : undefined,
    };
    // Client Offboarding slice, §10: an offboarding Enrollment is still
    // CURRENT operational work — Leif is actively winding it down, not
    // done with it — so it belongs in Active (each row's own Badge
    // already shows "Offboarding" distinctly, via ClientList.tsx's
    // existing per-row status badge), never silently buried under Past
    // before Complete client actually happens. Only "completed" is Past.
    if (enrollment.status === "onboarding") needsOnboarding.push(row);
    else if (
      enrollment.status === "active" ||
      enrollment.status === "offboarding"
    )
      active.push(row);
    else past.push(row);
  }

  return { isPending: false, needsOnboarding, active, past };
};
