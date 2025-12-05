import type { SortPayload } from "ra-core";
import { useStore } from "ra-core";

/**
 * @deprecated Use useSavedQueries from `ra-core` once available.
 */
export const useSavedQueries = (resource: string) => {
  return useStore<SavedQuery[]>(`${resource}.savedQueries`, []);
};

/**
 * @deprecated Use SavedQuery from `ra-core` once available.
 */
export interface SavedQuery {
  label: string;
  value: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    displayedFilters?: any[];
    sort?: SortPayload;
    perPage?: number;
  };
}

/**
 * @deprecated Use extractValidSavedQueries from `ra-core` once available.
 */
export const extractValidSavedQueries = (savedQueries: SavedQuery[]) => {
  if (Array.isArray(savedQueries)) {
    return savedQueries.filter((query) => isValidSavedQuery(query));
  }

  return [];
};

/**
 * @deprecated Use areValidSavedQueries from `ra-core` once available.
 */
export const areValidSavedQueries = (savedQueries: SavedQuery[]) => {
  if (
    Array.isArray(savedQueries) &&
    savedQueries.every((query) => isValidSavedQuery(query))
  ) {
    return true;
  }
};

/**
 * @deprecated Use isValidSavedQuery from `ra-core` once available.
 */
export const isValidSavedQuery = (savedQuery: SavedQuery) => {
  if (
    savedQuery.label &&
    typeof savedQuery.label === "string" &&
    savedQuery.value &&
    typeof Array.isArray(savedQuery.value.displayedFilters) &&
    typeof savedQuery.value.perPage === "number" &&
    typeof savedQuery.value.sort?.field === "string" &&
    typeof savedQuery.value.sort?.order === "string" &&
    typeof savedQuery.value.filter === "object"
  ) {
    return true;
  }

  return false;
};
