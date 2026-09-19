import { useGetList, useGetMany } from "ra-core";
import type { Identifier } from "ra-core";

import type {
  Cohort,
  Deal,
  Enrollment,
  EnrollmentStatusEvent,
  Offer,
} from "../types";
import {
  byMostRecentlyEndedFirst,
  byNewestStartFirst,
  bySoonestStartFirst,
  classifyEnrollment,
  type EnrollmentPhase,
} from "./classifyEnrollment";

// Which statuses end an engagement. Their event timestamps are the
// second-best evidence of when somebody finished, behind end_date.
const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "completed",
  "withdrawn",
  "ended",
]);

export type ClientRow = {
  enrollment: Enrollment;
  contactId: Identifier | undefined;
  offer: Offer | undefined;
  cohort: Cohort | undefined;
  phase: EnrollmentPhase;
  // When the CRM was told this engagement ended. Null when no terminal
  // event was ever recorded — most of the imported rows.
  terminalEventAt: string | null;
};

export type CohortGroup = {
  key: string;
  title: string;
  rows: ClientRow[];
};

// Backs the Clients list.
//
// Two things were wrong with the old grouping. It split on enrollment
// STATUS alone, so Daniel Alexander — agreed, set up, and starting on 8
// November — appeared under current clients seven weeks early. And it
// merged The Living Example and Growing Yourself Up into one undifferentiated
// list, which hides the only distinction that matters operationally: LE is
// a rolling 1:1 container with its own dates per person, GYU is a cohort
// that runs as a group.
//
// So: LE splits by TIME (upcoming / current / past), GYU groups by cohort,
// and each offer keeps its own shape.
export const useClientsGrouped = (): {
  isPending: boolean;
  livingExample: Record<EnrollmentPhase, ClientRow[]>;
  gyuCohorts: CohortGroup[];
  gyuPast: ClientRow[];
  other: ClientRow[];
} => {
  const { data: enrollments, isPending: enrollmentsPending } =
    useGetList<Enrollment>("enrollments", {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "created_at", order: "DESC" },
    });

  // Past ordering needs to know when each engagement ENDED, and only one
  // Enrollment in this database carries an end_date. The terminal status
  // event is the next-best real evidence, so it is fetched rather than
  // approximated from the start date the way Past used to be sorted.
  const { data: statusEvents, isPending: statusEventsPending } =
    useGetList<EnrollmentStatusEvent>("enrollment_status_events", {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "entered_at", order: "DESC" },
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
    statusEventsPending ||
    (dealIds.length > 0 &&
      (dealsPending ||
        (offerIds.length > 0 && offersPending) ||
        (cohortIds.length > 0 && cohortsPending)));

  const empty = {
    livingExample: { upcoming: [], current: [], past: [] },
    gyuCohorts: [],
    gyuPast: [],
    other: [],
  };

  if (isPending) return { isPending: true, ...empty };

  const dealById = new Map((deals ?? []).map((d) => [String(d.id), d]));
  const offerById = new Map((offers ?? []).map((o) => [String(o.id), o]));
  const cohortById = new Map((cohorts ?? []).map((c) => [String(c.id), c]));

  // The LATEST terminal event per Enrollment. A row that was completed,
  // reopened and completed again ended on the most recent one.
  const terminalEventByEnrollment = new Map<string, string>();
  for (const event of statusEvents ?? []) {
    if (!TERMINAL_STATUSES.has(event.status)) continue;
    const key = String(event.enrollment_id);
    const seen = terminalEventByEnrollment.get(key);
    if (!seen || event.entered_at > seen) {
      terminalEventByEnrollment.set(key, event.entered_at);
    }
  }

  const livingExample: Record<EnrollmentPhase, ClientRow[]> = {
    upcoming: [],
    current: [],
    past: [],
  };
  const gyuByCohort = new Map<string, ClientRow[]>();
  const gyuPast: ClientRow[] = [];
  const other: ClientRow[] = [];

  for (const enrollment of enrollments ?? []) {
    const deal = dealById.get(String(enrollment.opportunity_id));
    const offer = deal ? offerById.get(String(deal.offer_id)) : undefined;
    const row: ClientRow = {
      enrollment,
      contactId: deal?.contact_id ?? undefined,
      offer,
      cohort:
        deal?.cohort_id != null
          ? cohortById.get(String(deal.cohort_id))
          : undefined,
      phase: classifyEnrollment(enrollment),
      terminalEventAt:
        terminalEventByEnrollment.get(String(enrollment.id)) ?? null,
    };

    if (offer?.type === "group") {
      // A cohort that has finished for somebody is history regardless of
      // which cohort it was, so terminal rows leave the cohort sections.
      if (row.phase === "past") {
        gyuPast.push(row);
        continue;
      }
      const key = row.cohort ? String(row.cohort.id) : "no-cohort";
      const bucket = gyuByCohort.get(key) ?? [];
      bucket.push(row);
      gyuByCohort.set(key, bucket);
      continue;
    }

    if (offer?.type === "individual") {
      livingExample[row.phase].push(row);
      continue;
    }

    // An Enrollment whose Offer could not be resolved is shown rather
    // than silently dropped.
    other.push(row);
  }

  // Current: newest-starting at the top, Leif's stated order. Upcoming
  // reads forwards — the next container to prepare for comes first. Past
  // is most recently finished first.
  livingExample.current.sort((a, b) =>
    byNewestStartFirst(a.enrollment, b.enrollment),
  );
  livingExample.upcoming.sort((a, b) =>
    bySoonestStartFirst(a.enrollment, b.enrollment),
  );
  livingExample.past.sort((a, b) =>
    byMostRecentlyEndedFirst(
      { ...a.enrollment, terminalEventAt: a.terminalEventAt },
      { ...b.enrollment, terminalEventAt: b.terminalEventAt },
    ),
  );

  const gyuCohorts: CohortGroup[] = [...gyuByCohort.entries()]
    .map(([key, rows]) => ({
      key,
      title: rows[0]?.cohort?.name ?? "No cohort assigned",
      rows: rows.sort((a, b) =>
        (a.contactId ?? 0) > (b.contactId ?? 0) ? 1 : -1,
      ),
    }))
    // Newest cohort first, by name descending — cohort names carry their
    // own period ("Fall 2026", "January 2027"), so id order is the stable
    // proxy for when Leif set them up.
    .sort((a, b) => b.key.localeCompare(a.key, undefined, { numeric: true }));

  gyuPast.sort((a, b) =>
    byMostRecentlyEndedFirst(
      { ...a.enrollment, terminalEventAt: a.terminalEventAt },
      { ...b.enrollment, terminalEventAt: b.terminalEventAt },
    ),
  );

  return { isPending: false, livingExample, gyuCohorts, gyuPast, other };
};
