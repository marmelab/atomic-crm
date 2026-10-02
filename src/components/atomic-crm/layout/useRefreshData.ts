import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

/** Keep the spinner up at least this long, so a cache-warm refresh is not a flash. */
const MIN_SPINNER_MS = 400;

/**
 * Refetches every active query, and reports whether that is in flight — shared by the
 * two mobile refresh affordances, <MobileRefreshButton> and <PullToRefresh>.
 *
 * Same effect as ra-core's useRefresh, but awaitable, so a spinner can stop when the
 * data has actually come back rather than after a guessed delay.
 */
export const useRefreshData = () => {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Guards re-entrancy synchronously: state is a render behind, and refresh() is called
  // from raw DOM handlers.
  const isRefreshingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (isRefreshingRef.current) {
      return;
    }
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries(),
        new Promise((resolve) => setTimeout(resolve, MIN_SPINNER_MS)),
      ]);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [queryClient]);

  return { refresh, isRefreshing };
};
