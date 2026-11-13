import jsonExport from "jsonexport/dist";
import { downloadCSV, type Exporter } from "ra-core";

import { fromMinor } from "../money/money";
import type { Deal } from "../types";

/**
 * Deals as CSV, with amounts in whole currency units ("18000.5") as people
 * and the deal import expect them, next to their currency. The database keeps
 * minor units (1800050).
 */
export const dealExporter: Exporter<Deal> = (records) => {
  const deals = records.map((deal) => ({
    ...deal,
    amount:
      deal.amount == null ? undefined : fromMinor(deal.amount, deal.currency),
  }));
  return jsonExport(deals, {}, (_err: unknown, csv: string) => {
    downloadCSV(csv, "deals");
  });
};
