import React from "react";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { CoreAdminContext, memoryStore } from "ra-core";
import fakeDataProvider from "ra-data-fakerest";

import {
  NEW_BUSINESS_OFFERS_FILTER,
  isAvailableForNewBusiness,
} from "./newBusinessOffers";
import { ProgramsPage } from "../programs/ProgramsPage";

// "1:1 Coaching (Legacy)" exists so historical one-to-one work — which
// predates both current programmes — has something truthful to point at
// instead of being filed under Growing Yourself Up. It must be invisible to
// new business and fully visible in history; both halves are tested, because
// getting only the first half right would hide real clients' own records.
const offers = [
  {
    id: 1,
    name: "The Living Example",
    type: "individual",
    duration: "4 months",
    current_price: 4000,
    is_active: true,
    max_active_clients: 12,
  },
  {
    id: 2,
    name: "Growing Yourself Up",
    type: "group",
    duration: "8 weeks",
    current_price: 1400,
    is_active: true,
    max_active_clients: null,
  },
  {
    id: 3,
    name: "1:1 Coaching (Legacy)",
    type: "individual",
    duration: "Varies (historical)",
    current_price: 0,
    is_active: false,
    max_active_clients: null,
  },
];

describe("isAvailableForNewBusiness", () => {
  it("accepts an active Offer and rejects a retired one", () => {
    expect(isAvailableForNewBusiness({ is_active: true })).toBe(true);
    expect(isAvailableForNewBusiness({ is_active: false })).toBe(false);
  });

  it("filters on is_active, which is what every new-business picker passes", () => {
    expect(NEW_BUSINESS_OFFERS_FILTER).toEqual({ is_active: true });
  });
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <CoreAdminContext
    dataProvider={fakeDataProvider({ offers, cohorts: [] }, false)}
    store={memoryStore()}
  >
    {children}
  </CoreAdminContext>
);

describe("Programs navigation", () => {
  it("does not offer a retired Offer as somewhere to start new business", async () => {
    await page.viewport(1280, 900);
    const screen = await render(<ProgramsPage />, { wrapper: Wrapper });

    await expect
      .element(screen.getByText("The Living Example"))
      .toBeInTheDocument();
    // The whole point: Leif must not be invited to sell this again.
    await expect
      .element(screen.getByText("1:1 Coaching (Legacy)"))
      .not.toBeInTheDocument();
  });
});

// The inverse, proven where history is displayed: an inactive Offer still
// resolves by id and still shows its real historical name. Nothing filters
// history by is_active, because hiding a client's own record because their
// programme was retired would be worse than the bug this all fixes.
describe("historical resolution of a retired Offer", () => {
  it("still resolves the retired Offer by id, with its real name", async () => {
    const provider = fakeDataProvider({ offers, cohorts: [] }, false);
    const { data } = await provider.getOne("offers", { id: 3 });
    expect(data.name).toBe("1:1 Coaching (Legacy)");
    expect(data.is_active).toBe(false);
  });

  it("returns the retired Offer in an unfiltered list, and omits it only when the new-business filter is applied", async () => {
    const provider = fakeDataProvider({ offers, cohorts: [] }, false);

    const all = await provider.getList("offers", {
      filter: {},
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    });
    expect(all.data.map((o) => o.id)).toContain(3);

    const forNewBusiness = await provider.getList("offers", {
      filter: NEW_BUSINESS_OFFERS_FILTER,
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    });
    expect(forNewBusiness.data.map((o) => o.id)).not.toContain(3);
    expect(forNewBusiness.data.map((o) => o.id)).toEqual([1, 2]);
  });
});
