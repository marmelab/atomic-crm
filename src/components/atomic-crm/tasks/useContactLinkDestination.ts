import { useGetList } from "ra-core";
import type { Identifier } from "ra-core";

import { CURRENT_OPERATIONAL_ENROLLMENT_STATUSES } from "../enrollments/enrollmentConstants";
import type { Deal, Enrollment } from "../types";

// Manual Task UX repair, round 2 — the person link on a Task row (only
// where a Contact isn't already the obvious page context, i.e.
// showContact=true: Dashboard, other cross-contact lists) now goes
// straight to the Client/Enrollment operational home when that's
// unambiguous, since Leif generally works Tasks from there once someone
// has a current Enrollment — same "Atomic handles certainty, Leif
// handles ambiguity" governing principle as the rest of this codebase's
// exception handling. Deliberately the SAME shared helper for every
// Task-row surface (Task.tsx is the one shared row component), never
// duplicated per-page routing logic.
//
// Walks Contact -> Deals -> Enrollments (an Enrollment has no direct
// contact_id of its own — see types.ts) exactly like
// useTaskActionDestination.ts's own opportunity-context resolution does
// for the same reason: no direct FK shortcut exists.
export const useContactLinkDestination = (
  contactId: Identifier | null | undefined,
): { to: string; isPending: boolean } => {
  const contactShowPath = `/contacts/${contactId}/show`;

  const { data: deals, isPending: dealsPending } = useGetList<Deal>(
    "deals",
    {
      filter: { contact_id: contactId },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    },
    // A failed/slow resolution should fall back to the Contact page
    // immediately, same "never block on a non-critical navigation
    // affordance" reasoning as useTaskActionDestination.ts.
    { enabled: contactId != null, retry: false },
  );

  const dealIds = deals?.map((deal) => deal.id) ?? [];
  const { data: enrollments, isPending: enrollmentsPending } =
    useGetList<Enrollment>(
      "enrollments",
      {
        filter: { "opportunity_id@in": `(${dealIds.join(",")})` },
        pagination: { page: 1, perPage: 100 },
        sort: { field: "id", order: "ASC" },
      },
      { enabled: dealIds.length > 0, retry: false },
    );

  if (contactId == null) {
    return { to: contactShowPath, isPending: false };
  }
  if (dealsPending) {
    return { to: contactShowPath, isPending: true };
  }
  if (dealIds.length === 0) {
    return { to: contactShowPath, isPending: false };
  }
  if (enrollmentsPending) {
    return { to: contactShowPath, isPending: true };
  }

  const currentEnrollments = (enrollments ?? []).filter((enrollment) =>
    CURRENT_OPERATIONAL_ENROLLMENT_STATUSES.has(enrollment.status),
  );

  // Exactly one current operational Enrollment: unambiguous, go straight
  // there. Zero or 2+: never guess which one Leif means — Contact page,
  // same as before this repair.
  if (currentEnrollments.length === 1) {
    return {
      to: `/enrollments/${currentEnrollments[0].id}/show`,
      isPending: false,
    };
  }
  return { to: contactShowPath, isPending: false };
};
