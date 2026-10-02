import { useCallback } from "react";
import { useDataProvider, useGetIdentity, type DataProvider } from "ra-core";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { useCompanyResolver } from "./useCompanyResolver";
import { createEachRow } from "./createEachRow";
import { toConfiguredValue, toInteger, toIsoDate, toText } from "./parseCell";
import type { ImportRow, ProcessImportBatch } from "./types";

/** One CSV row, with the values needed before its deal can be created. */
type DealRow = {
  row: ImportRow;
  companyName: string | undefined;
  stage: string | undefined;
};

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
      // Parse the company name and the stage once per row: both are needed to
      // resolve companies and column indexes up front, then again per deal.
      const rows: DealRow[] = batch.map((row) => ({
        row,
        companyName: toText(row.company),
        // stage is required, so fall back to the first configured one
        stage: toConfiguredValue(row.stage, dealStages) ?? dealStages[0]?.value,
      }));

      const [companies, indexes] = await Promise.all([
        getCompanies(
          rows
            .map(({ companyName }) => companyName)
            .filter((name): name is string => name !== undefined),
        ),
        appendedIndexes(rows, dataProvider),
      ]);

      const now = new Date().toISOString();
      return createEachRow(
        rows.map(({ row, companyName, stage }) =>
          dataProvider.create("deals", {
            data: {
              name: toText(row.name),
              company_id: companyName
                ? companies.get(companyName)?.id
                : undefined,
              contact_ids: [],
              category: toConfiguredValue(row.category, dealCategories),
              stage,
              description: toText(row.description),
              // amount lands in a bigint column, which rejects "4500.50"
              amount: toInteger(row.amount),
              expected_closing_date: toIsoDate(row.expected_closing_date),
              sales_id: identity?.id,
              index: indexes.get(row) ?? 0,
              created_at: now,
              updated_at: now,
            },
          }),
        ),
      );
    },
    [dataProvider, dealCategories, dealStages, getCompanies, identity?.id],
  );
}

/**
 * One distinct index per imported deal, appended below the deals already in its
 * stage and keeping the CSV row order.
 *
 * The Kanban board sorts each column on `index`, and its drag handler shifts the
 * indexes of the cards around the drop target. A column whose deals all share
 * `index: 0` therefore cannot be reordered — the drop writes `index: 0` again
 * and the card snaps back — and its order is whatever the backend returns.
 */
const appendedIndexes = async (
  rows: DealRow[],
  dataProvider: DataProvider,
): Promise<Map<ImportRow, number>> => {
  const stages = [
    ...new Set(
      rows
        .map(({ stage }) => stage)
        .filter((stage): stage is string => stage !== undefined),
    ),
  ];
  const lastIndexes = new Map(
    await Promise.all(
      stages.map(
        async (stage) =>
          [stage, await lastIndexOf(stage, dataProvider)] as const,
      ),
    ),
  );

  return new Map(
    stages.flatMap((stage) => {
      const firstIndex = (lastIndexes.get(stage) ?? -1) + 1;
      return rows
        .filter((candidate) => candidate.stage === stage)
        .map(({ row }, position) => [row, firstIndex + position] as const);
    }),
  );
};

/** Highest index currently used in a stage, or -1 when it holds no deal. */
const lastIndexOf = async (stage: string, dataProvider: DataProvider) => {
  const { data } = await dataProvider.getList("deals", {
    filter: { stage },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "index", order: "DESC" },
  });
  return data[0]?.index ?? -1;
};
