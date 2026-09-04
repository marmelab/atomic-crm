import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Deal, Offer } from "../types";
import { ensureOfferPageToken } from "./offerPageToken";

const CONTACT_ID = 1;
const OFFER_ID = 1;
const DEAL_ID = 1;

const buildOffer = (): Offer => ({
  id: OFFER_ID,
  name: "The Living Example",
  type: "individual",
  duration: "6 months",
  current_price: 4000,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

const buildDeal = (overrides: Partial<Deal> = {}): Deal => ({
  id: DEAL_ID,
  name: "Ada Lovelace — The Living Example",
  contact_id: CONTACT_ID,
  offer_id: OFFER_ID,
  stage: "committed",
  outcome: null,
  owner_decision: "would_work_with",
  prospect_decision: "yes",
  amount: 4000,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  sales_id: 0,
  index: 0,
  stage_entered_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildFixtures = (dealOverrides: Partial<Deal> = {}) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [buildContact({ id: CONTACT_ID })],
      offers: [buildOffer()],
      deals: [buildDeal(dealOverrides)],
    }),
    silent: true,
    latency: 0,
  });
  return { dataProvider };
};

describe("ensureOfferPageToken", () => {
  it("generates a real token for a Deal that has none", async () => {
    const { dataProvider } = buildFixtures();

    const token = await ensureOfferPageToken(dataProvider, DEAL_ID);
    expect(token).toBeTruthy();

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.offer_page_token).toBe(token);
  });

  it("is idempotent: a Deal that already has a token keeps the exact same one", async () => {
    const { dataProvider } = buildFixtures({
      offer_page_token: "already-issued-token",
    });

    const token = await ensureOfferPageToken(dataProvider, DEAL_ID);
    expect(token).toBe("already-issued-token");
  });

  it("two Deals never receive the same token", async () => {
    const { dataProvider } = buildFixtures();
    await dataProvider.create("deals", {
      data: {
        ...buildDeal({ id: 2 }),
        id: undefined,
      },
    });

    const tokenA = await ensureOfferPageToken(dataProvider, DEAL_ID);
    const { data: dealB } = await dataProvider.getList<Deal>("deals", {
      filter: { id: 2 },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    });
    const tokenB = await ensureOfferPageToken(dataProvider, dealB[0]!.id);
    expect(tokenA).not.toBe(tokenB);
  });
});
