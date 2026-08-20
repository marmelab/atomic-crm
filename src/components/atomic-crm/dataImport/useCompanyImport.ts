import { useCallback } from "react";
import { useDataProvider, useGetIdentity } from "ra-core";

import { mapSizeToCategory } from "../companies/sizes";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { toConfiguredValue, toNumber, toText } from "./parseCell";
import type { ImportCell, ProcessImportBatch } from "./types";

/**
 * Creates a company per CSV row. Unknown columns are ignored, missing ones are
 * left empty — except `name`, which the database requires.
 */
export function useCompanyImport(): ProcessImportBatch {
  const { companySectors } = useConfigurationContext();
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider();

  return useCallback(
    async (batch) => {
      await Promise.all(
        batch.map((row) =>
          dataProvider.create("companies", {
            data: {
              name: toText(row.name),
              sector: toConfiguredValue(row.sector, companySectors),
              size: sizeOf(row.size),
              linkedin_url: toText(row.linkedin_url),
              website: toText(row.website),
              phone_number: toText(row.phone_number),
              address: toText(row.address),
              zipcode: toText(row.zipcode),
              city: toText(row.city),
              state_abbr: toText(row.state_abbr),
              country: toText(row.country),
              description: toText(row.description),
              revenue: toText(row.revenue),
              tax_identifier: toText(row.tax_identifier),
              sales_id: identity?.id,
              created_at: new Date().toISOString(),
            },
          }),
        ),
      );
    },
    [companySectors, dataProvider, identity?.id],
  );
}

/**
 * `size` is a bucket id, not a headcount, so an arbitrary CSV number is coerced
 * into the nearest bucket the company screens can render.
 */
const sizeOf = (cell: ImportCell) => {
  const size = toNumber(cell);
  return size === undefined ? undefined : mapSizeToCategory(size);
};
