import type { Identifier } from "ra-core";

export type UpcomingOpeningClient = {
  contactId: Identifier;
  name: string;
};

export type UpcomingOpening = {
  date: string;
  count: number;
  clients: UpcomingOpeningClient[];
};

export type ActiveSlotEnrollment = {
  endDate: string | null;
  contactId: Identifier;
  name: string;
};

// Groups real, future-dated, slot-occupying Enrollment end dates into
// human-readable openings ("Dec 10 — 1 opening — Kathy completes"),
// Programs + Opportunity UX slice §9. `activeSlotEnrollments` must already
// be filtered to statuses that occupy a slot (Onboarding/Active/
// Offboarding) — Completed Enrollments never free a slot they no longer
// hold, so callers must exclude them before calling this. Pure/testable:
// no data fetching, no "today" default so tests are deterministic.
export const computeUpcomingOpenings = (
  activeSlotEnrollments: ActiveSlotEnrollment[],
  now: Date,
): UpcomingOpening[] => {
  const byDate = new Map<string, UpcomingOpeningClient[]>();

  for (const enrollment of activeSlotEnrollments) {
    if (!enrollment.endDate) continue;
    if (new Date(enrollment.endDate) < now) continue;

    const clients = byDate.get(enrollment.endDate) ?? [];
    clients.push({ contactId: enrollment.contactId, name: enrollment.name });
    byDate.set(enrollment.endDate, clients);
  }

  return Array.from(byDate.entries())
    .map(([date, clients]) => ({ date, count: clients.length, clients }))
    .sort((a, b) => a.date.localeCompare(b.date));
};
