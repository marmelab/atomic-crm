import { useCallback } from "react";
import { useDataProvider, useGetIdentity } from "ra-core";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { useCompanyResolver } from "./useCompanyResolver";
import { toConfiguredValue, toIsoDate, toNumber, toText } from "./parseCell";
import type { ProcessImportBatch } from "./types";

/**
 * Creates a deal per CSV row. Unknown columns are ignored, missing ones are
 * left empty — except `name`, which the database requires. The `company` column
 * holds a company name: matching companies are reused, unknown ones are created.
 */
export function useDealImport(): ProcessImportBatch {
  const { dealCategories, dealStages } = useConfigurationContext();
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider();
  const getCompanies = useCompanyResolver();

  return useCallback(
    async (batch) => {
      // Parse the company name once per row: it is needed to resolve the
      // companies up front, then again to link each deal to its own.
      const rows = batch.map((row) => ({
        row,
        companyName: toText(row.company),
      }));
      const companies = await getCompanies(
        rows
          .map(({ companyName }) => companyName)
          .filter((name): name is string => name !== undefined),
      );

      const now = new Date().toISOString();
      await Promise.all(
        rows.map(({ row, companyName }) => {
          return dataProvider.create("deals", {
            data: {
              name: toText(row.name),
              company_id: companyName
                ? companies.get(companyName)?.id
                : undefined,
              contact_ids: [],
              category: toConfiguredValue(row.category, dealCategories),
              // stage is required, so fall back to the first configured one
              stage:
                toConfiguredValue(row.stage, dealStages) ??
                dealStages[0]?.value,
              description: toText(row.description),
              amount: toNumber(row.amount),
              expected_closing_date: toIsoDate(row.expected_closing_date),
              sales_id: identity?.id,
              index: 0,
              created_at: now,
              updated_at: now,
            },
          });
        }),
      );
    },
    [dataProvider, dealCategories, dealStages, getCompanies, identity?.id],
  );
}
