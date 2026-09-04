import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Deal, Offer } from "../types";
import { recordOfferPageOpened } from "./recordOfferPageOpened";

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
  amount: 4000,
  offer_page_token: "a-real-token",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  sales_id: 0,
  index: 0,
  stage_entered_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildFixtures = (dealOverrides: Partial<Deal> = {}) =>
  createDataProvider({
    db: createCrmDb({
      contacts: [buildContact({ id: CONTACT_ID })],
      offers: [buildOffer()],
      deals: [buildDeal(dealOverrides)],
    }),
    silent: true,
    latency: 0,
  });

describe("recordOfferPageOpened", () => {
  it("records the first open", async () => {
    const dataProvider = buildFixtures();

    await recordOfferPageOpened(dataProvider, DEAL_ID);

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.offer_page_opened_at).toBeTruthy();
  });

  it("never overwrites the first-open timestamp on a later visit", async () => {
    const dataProvider = buildFixtures({
      offer_page_opened_at: "2026-01-01T00:00:00.000Z",
    });

    await recordOfferPageOpened(dataProvider, DEAL_ID);

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.offer_page_opened_at).toBe("2026-01-01T00:00:00.000Z");
  });
});
