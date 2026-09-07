import type { DataProvider, Identifier } from "ra-core";

import type { EnrollmentExpectedSession } from "../types";

// Client + Session Operations Service Period model: the shared lookup
// behind markClientSessionNoShow.ts/reverseClientSessionNoShow.ts —
// given a session's own Enrollment and scheduled time, finds the
// Enrollment's own frozen enrollment_expected_sessions slot it falls
// inside, if any (never the raw shared expected_session_windows —
// fulfillment/cadence always reads the Enrollment's own snapshotted
// dates, immune to a later edit of the source calendar event). A session
// outside every assigned slot (no Service Period slot covers it, or none
// have been assigned yet) resolves to null — callers must treat that as
// "nothing to reactivate," never guess a slot.
export const findEnrollmentExpectedSessionForSession = async (
  dataProvider: DataProvider,
  {
    enrollmentId,
    scheduledAt,
  }: { enrollmentId: Identifier; scheduledAt: string },
): Promise<EnrollmentExpectedSession | null> => {
  const { data: slots } = await dataProvider.getList<EnrollmentExpectedSession>(
    "enrollment_expected_sessions",
    {
      filter: { enrollment_id: enrollmentId },
      pagination: { page: 1, perPage: 12 },
      sort: { field: "ordinal", order: "ASC" },
    },
  );

  const scheduledTime = new Date(scheduledAt).getTime();
  return (
    slots.find(
      (slot) =>
        scheduledTime >= new Date(slot.window_start).getTime() &&
        scheduledTime < new Date(slot.window_end).getTime(),
    ) ?? null
  );
};
