import { useGetList } from "ra-core";

import type { FeedbackItem, FeedbackStatus } from "../types";

/**
 * Hämtar feedback-tråden för den delade inkorgen.
 *
 * - Sorterar ASC på created_at så nyaste hamnar nederst (chatt-ordning).
 * - Pollar var 15:e sekund när panelen är öppen så att teamets poster
 *   dyker upp live; polling pausas helt när panelen är stängd.
 */
export const useGetFeedback = (open: boolean, statusFilter?: FeedbackStatus) =>
  useGetList<FeedbackItem>(
    "feedback_items",
    {
      sort: { field: "created_at", order: "ASC" },
      pagination: { page: 1, perPage: 200 },
      filter: statusFilter ? { status: statusFilter } : {},
    },
    {
      enabled: open,
      refetchInterval: open ? 15000 : false,
      refetchOnWindowFocus: true,
    },
  );
