import { useResourceDefinitions } from "ra-core";

import type { ContactImportSchema } from "../contacts/useContactImport";
import { useContactImport } from "../contacts/useContactImport";
import companiesSampleCsv from "./companies_sample.csv?raw";
import dealsSampleCsv from "./deals_sample.csv?raw";
import productsSampleCsv from "./products_sample.csv?raw";
import contactsSampleCsv from "../contacts/contacts_export.csv?raw";
import type { ImportableResource } from "./types";
import { useCompanyImport } from "./useCompanyImport";
import { useDealImport } from "./useDealImport";
import { useProductImport } from "./useProductImport";
import { REQUISITE_COLUMNS } from "./counterpartyColumns";

/** Every resource a CSV can be imported into, in the order the dialog offers them. */
export const IMPORTABLE_RESOURCES = [
  "contacts",
  "companies",
  "deals",
  "products",
] as const;

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
  const processProducts = useProductImport();
  const definitions = useResourceDefinitions();

  const resources: ImportableResource[] = [
    {
      name: "contacts",
      sampleCsv: contactsSampleCsv,
      textColumns: ["phone_work", "phone_home", "phone_other"],
      // The contact importer predates the shared ImportRow type and declares
      // its own all-string schema; it reads the same parsed cells.
      processBatch: (batch) => processContacts(batch as ContactImportSchema[]),
    },
    {
      name: "companies",
      sampleCsv: companiesSampleCsv,
      // These are text columns whose leading zero must survive the parsing:
      // a "02134" zipcode would otherwise be stored as 2134.
      textColumns: [
        "zipcode",
        "phone_number",
        "tax_identifier",
        ...REQUISITE_COLUMNS,
      ],
      processBatch: processCompanies,
    },
    { name: "deals", sampleCsv: dealsSampleCsv, processBatch: processDeals },
    {
      name: "products",
      sampleCsv: productsSampleCsv,
      // Article numbers and barcodes keep their leading zeros
      textColumns: ["sku", "barcode"],
      processBatch: processProducts,
    },
  ];

  return resources.filter(({ name }) => name in definitions);
}
