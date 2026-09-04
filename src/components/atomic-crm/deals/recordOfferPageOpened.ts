import type { DataProvider, Identifier } from "ra-core";

import type { Deal } from "../types";

// Payment domain foundation slice: "did they even look" — a lightweight
// signal, not a state machine (see the schema's own comment on
// deals.offer_page_opened_at). Idempotent: only the FIRST open is ever
// recorded; a re-visit never overwrites it, so it stays meaningful as
// "when this offer was first actually seen."
export const recordOfferPageOpened = async (
  dataProvider: DataProvider,
  dealId: Identifier,
): Promise<void> => {
  const { data: deal } = await dataProvider.getOne<Deal>("deals", {
    id: dealId,
  });
  if (deal.offer_page_opened_at) return;

  await dataProvider.update<Deal>("deals", {
    id: dealId,
    data: { offer_page_opened_at: new Date().toISOString() },
    previousData: deal,
  });
};
