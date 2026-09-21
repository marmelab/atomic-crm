import { useGetList, type Identifier } from "ra-core";

import type { ExpectedSessionWindow } from "../types";
import type { SessionWeek } from "./sessionWeeks";

// The Year Tracking calendar, as the CRM already holds it.
//
// There is exactly one Google Calendar integration and this reads it. The
// `1:1s` events Leif marks in Year Tracking are synced into
// expected_session_windows by the sync_year_planning_calendar Edge
// Function — idempotent by (calendar id, event id), soft-deleted when an
// event disappears — and every capacity surface derives its dates from
// these rows. Nothing here talks to Google, and nothing adds a second
// synchronisation path.
export const useSessionWeeks = (offerId?: Identifier) => {
  const { data, isPending } = useGetList<ExpectedSessionWindow>(
    "expected_session_windows",
    {
      filter: { offer_id: offerId },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "window_start", order: "ASC" },
    },
    { enabled: offerId != null },
  );

  // A soft-deleted window is an event Leif removed from the calendar. It
  // is kept for the audit trail of any cadence issue that referenced it,
  // and it is not an available week any more.
  const weeks: SessionWeek[] = (data ?? [])
    .filter((window) => window.deleted_at == null)
    .map((window) => ({
      start: window.window_start,
      end: window.window_end,
      title: window.raw_title,
    }));

  const lastSyncedAt = (data ?? []).reduce<string | null>(
    (latest, window) =>
      !latest || (window.synced_at ?? "") > latest
        ? (window.synced_at ?? latest)
        : latest,
    null,
  );

  return { isPending: offerId != null && isPending, weeks, lastSyncedAt };
};
