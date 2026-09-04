import type { DataProvider, Identifier } from "ra-core";

import type { Deal } from "../types";

// Payment domain foundation slice: generates the opaque public token the
// personalized Offer Page resolves a Deal by (never the Deal's own
// sequential id — see the schema's own comment on deals.offer_page_token).
// Idempotent: a Deal that already has a token keeps it — re-running this
// (e.g. a second "would_work_with"/"yes" outcome recorded on the same
// Opportunity, which completeSalesCallOutcome.ts's own idempotent guard
// should already prevent, but this stays defensive) never rotates an
// already-issued, possibly-already-shared link out from under a prospect.
export const ensureOfferPageToken = async (
  dataProvider: DataProvider,
  dealId: Identifier,
): Promise<string> => {
  const { data: deal } = await dataProvider.getOne<Deal>("deals", {
    id: dealId,
  });
  if (deal.offer_page_token) return deal.offer_page_token;

  const token = crypto.randomUUID();
  await dataProvider.update<Deal>("deals", {
    id: dealId,
    data: { offer_page_token: token },
    previousData: deal,
  });
  return token;
};
