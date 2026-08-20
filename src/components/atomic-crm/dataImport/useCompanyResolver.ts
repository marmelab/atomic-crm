import { useCallback, useMemo } from "react";
import { useDataProvider, useGetIdentity } from "ra-core";

import type { Company } from "../types";
import { fetchRecordsWithCache } from "./fetchRecordsWithCache";

/**
 * Resolves companies by name, creating the missing ones. Both the contact and
 * the deal importer name companies in a text column, so they share one cache:
 * a company named twice in a CSV is created once.
 */
export function useCompanyResolver() {
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider();

  // Cache is dependent of dataProvider, so it's safe to use it as a dependency
  const companiesCache = useMemo(
    () => new Map<string, Company>(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataProvider],
  );

  return useCallback(
    (names: string[]) =>
      fetchRecordsWithCache<Company>(
        "companies",
        companiesCache,
        names,
        (name) => ({
          name,
          created_at: new Date().toISOString(),
          sales_id: identity?.id,
        }),
        dataProvider,
      ),
    [companiesCache, dataProvider, identity?.id],
  );
}
