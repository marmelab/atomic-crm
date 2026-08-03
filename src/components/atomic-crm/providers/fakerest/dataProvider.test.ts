import type { Db } from "./dataGenerator/types";
import { USER_STORAGE_KEY } from "./authProvider";
import { createDataProvider } from "./dataProvider";

const ADMIN_SALE_ID = 0;

const createDb = (): Db =>
  ({
    companies: [],
    configuration: [{ config: {}, id: 1 }],
    contact_notes: [],
    contacts: [],
    deal_notes: [],
    deals: [],
    sales: [
      {
        administrator: true,
        disabled: false,
        email: "janedoe@atomic.dev",
        first_name: "Jane",
        id: ADMIN_SALE_ID,
        last_name: "Doe",
        user_id: String(ADMIN_SALE_ID),
      },
    ],
    tags: [],
    tasks: [],
  }) as Db;

describe("fakerest preferences", () => {
  it("round trips the preferences of the logged sale, whose id is 0", async () => {
    localStorage.setItem(
      USER_STORAGE_KEY,
      JSON.stringify({ id: ADMIN_SALE_ID }),
    );
    const dataProvider = createDataProvider({
      db: createDb(),
      latency: 0,
      silent: true,
    });

    expect(await dataProvider.getPreferences()).toEqual({});

    await dataProvider.updatePreferences({ theme: "dark" });
    expect(await dataProvider.getPreferences()).toEqual({ theme: "dark" });

    await dataProvider.updatePreferences({ locale: "fr" });
    expect(await dataProvider.getPreferences()).toEqual({
      theme: "dark",
      locale: "fr",
    });
  });

  it("does not touch any sale when nobody is logged in", async () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    const dataProvider = createDataProvider({
      db: createDb(),
      latency: 0,
      silent: true,
    });

    expect(await dataProvider.getPreferences()).toEqual({});

    await dataProvider.updatePreferences({ theme: "dark" });
    localStorage.setItem(
      USER_STORAGE_KEY,
      JSON.stringify({ id: ADMIN_SALE_ID }),
    );
    expect(await dataProvider.getPreferences()).toEqual({});
  });
});
