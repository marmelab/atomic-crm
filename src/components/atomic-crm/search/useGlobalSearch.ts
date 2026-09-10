import { useGetList } from "ra-core";
import { useEffect, useState } from "react";

import type { SearchResourceName, SearchResult } from "../types";

export const MIN_SEARCH_LENGTH = 2;
const DEBOUNCE_MS = 300;
const MAX_RESULTS = 50;

const DISPLAYED_COLUMNS = [
  "id",
  "resource",
  "record_id",
  "title",
  "subtitle",
  "contact_id",
  "deal_id",
] as const;

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
 * does not fire a request. `resources` restricts the query server-side, so the
 * row cap is spent only on resources the current layout can actually link to.
 */
export const useGlobalSearch = (
  query: string,
  resources: readonly SearchResourceName[],
) => {
  const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const isEnabled = debouncedQuery.length >= MIN_SEARCH_LENGTH;

  const { data, isPending, error } = useGetList<SearchResult>(
    "search_index",
    {
      filter: {
        q: debouncedQuery,
        "resource@in": `(${resources.join(",")})`,
      },
      pagination: { page: 1, perPage: MAX_RESULTS },
      sort: { field: "date", order: "DESC" },
      meta: { columns: [...DISPLAYED_COLUMNS] },
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
