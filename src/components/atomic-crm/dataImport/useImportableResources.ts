import { useResourceDefinitions } from "ra-core";

import type { ContactImportSchema } from "../contacts/useContactImport";
import { useContactImport } from "../contacts/useContactImport";
import companiesSampleCsv from "./companies_sample.csv?raw";
import dealsSampleCsv from "./deals_sample.csv?raw";
import contactsSampleCsv from "../contacts/contacts_export.csv?raw";
import type { ImportableResource } from "./types";
import { useCompanyImport } from "./useCompanyImport";
import { useDealImport } from "./useDealImport";

/** Every resource a CSV can be imported into, in the order the dialog offers them. */
export const IMPORTABLE_RESOURCES = ["contacts", "companies", "deals"] as const;

export type ImportableResourceName = (typeof IMPORTABLE_RESOURCES)[number];

/**
 * The importable resources, restricted to those the running Admin registers:
 * the mobile app has no deals screens, so it must not offer to import records
 * the user would never be able to see.
 */
export function useImportableResources(): ImportableResource[] {
  const processContacts = useContactImport();
  const processCompanies = useCompanyImport();
  const processDeals = useDealImport();
  const definitions = useResourceDefinitions();

  const resources: ImportableResource[] = [
    {
      name: "contacts",
      sampleCsv: contactsSampleCsv,
      // The contact importer predates the shared ImportRow type and declares
      // its own all-string schema; it reads the same parsed cells.
      processBatch: (batch) => processContacts(batch as ContactImportSchema[]),
    },
    {
      name: "companies",
      sampleCsv: companiesSampleCsv,
      processBatch: processCompanies,
    },
    { name: "deals", sampleCsv: dealsSampleCsv, processBatch: processDeals },
  ];

  return resources.filter(({ name }) => name in definitions);
}
