import { useGetList } from "ra-core";
import { useEffect, useState } from "react";

import type { SearchResult } from "../types";

export const MIN_SEARCH_LENGTH = 2;
const DEBOUNCE_MS = 300;
const MAX_RESULTS = 50;

export const useDebouncedValue = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Query the `search_index` view for a debounced search term.
 *
 * Stays idle until the term reaches MIN_SEARCH_LENGTH, so opening the dialog
 * does not fire a request.
 */
export const useGlobalSearch = (query: string) => {
  const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const isEnabled = debouncedQuery.length >= MIN_SEARCH_LENGTH;

  const { data, isPending, error } = useGetList<SearchResult>(
    "search_index",
    {
      filter: { q: debouncedQuery },
      pagination: { page: 1, perPage: MAX_RESULTS },
      sort: { field: "date", order: "DESC" },
    },
    { enabled: isEnabled },
  );

  return {
    results: isEnabled ? (data ?? []) : [],
    isPending: isEnabled && isPending,
    error,
    debouncedQuery,
  };
};
