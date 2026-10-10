import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";
import { useEffect, useState } from "react";

import type { CrmDataProvider } from "../providers/types";
import type { SearchResourceName } from "../types";

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
 * Run the global search for a debounced search term.
 *
 * Stays idle until the term reaches MIN_SEARCH_LENGTH, so opening the dialog
 * does not fire a request. `resources` restricts the query server-side, so the
 * row cap is spent only on resources the current layout can actually link to.
 */
export const useGlobalSearch = (
  query: string,
  resources: readonly SearchResourceName[],
) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const isEnabled = debouncedQuery.length >= MIN_SEARCH_LENGTH;

  const { data, isPending, error } = useQuery({
    queryKey: ["globalSearch", debouncedQuery, resources],
    queryFn: () =>
      dataProvider.globalSearch(debouncedQuery, resources, MAX_RESULTS),
    enabled: isEnabled,
  });

  return {
    results: isEnabled ? (data ?? []) : [],
    isPending: isEnabled && isPending,
    error,
    debouncedQuery,
  };
};
