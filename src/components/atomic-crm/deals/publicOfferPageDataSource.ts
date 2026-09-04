import type { DataProvider } from "ra-core";

import type { PublicOfferPageContext } from "./publicOfferPageContext";
import { getOfferPageContext } from "./publicOfferPageContext";
import { recordOfferPageOpened } from "./recordOfferPageOpened";

// The boundary the public Offer Page actually depends on — same dual-
// implementation convention as public-application/
// publicApplicationDataSource.ts: a FakeRest/dev implementation (reads go
// straight through the shared dataProvider) and a production one
// (supabase/publicOfferPageDataSource.ts, calling an Edge Function, since
// every table's RLS is `to authenticated` only). Each app entry picks the
// one that matches its own environment — the page component never knows
// which one it got.
export type PublicOfferPageDataSource = {
  getContext: (token: string) => Promise<PublicOfferPageContext>;
  recordOpened: (token: string) => Promise<void>;
};

export const createDataProviderPublicOfferPageDataSource = (
  dataProvider: DataProvider,
): PublicOfferPageDataSource => ({
  getContext: (token) => getOfferPageContext(dataProvider, token),
  recordOpened: async (token) => {
    const { data: deals } = await dataProvider.getList("deals", {
      filter: { offer_page_token: token },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    });
    const deal = deals[0];
    if (deal) await recordOfferPageOpened(dataProvider, deal.id);
  },
});
