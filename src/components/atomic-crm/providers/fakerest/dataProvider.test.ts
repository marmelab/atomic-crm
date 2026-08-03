import { createCrmDb } from "@/test/StoryWrapper";
import { DEFAULT_USER, USER_STORAGE_KEY } from "./authProvider";
import { createDataProvider } from "./dataProvider";

const createProvider = () =>
  createDataProvider({ db: createCrmDb(), latency: 0, silent: true });

describe("fakerest preferences", () => {
  it("round trips the preferences of the logged sale, whose id is 0", async () => {
    expect(DEFAULT_USER.id).toBe(0);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(DEFAULT_USER));
    const dataProvider = createProvider();

    expect(await dataProvider.getPreferences()).toEqual({});

    await dataProvider.updatePreferences({ theme: "dark" });
    expect(await dataProvider.getPreferences()).toEqual({ theme: "dark" });

    await dataProvider.updatePreferences({ locale: "fr" });
    expect(await dataProvider.getPreferences()).toEqual({
      theme: "dark",
      locale: "fr",
    });
  });

  it("keeps keys it does not know about when writing", async () => {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(DEFAULT_USER));
    const db = structuredClone(createCrmDb());
    db.sales[0].preferences = {
      locale: "fr",
      writtenByAnotherVersion: "keep me",
    } as never;
    const dataProvider = createDataProvider({ db, latency: 0, silent: true });

    await dataProvider.updatePreferences({ theme: "dark" });

    const { data } = await dataProvider.getOne("sales", {
      id: DEFAULT_USER.id,
    });
    expect(data.preferences).toEqual({
      theme: "dark",
      locale: "fr",
      writtenByAnotherVersion: "keep me",
    });
    expect(await dataProvider.getPreferences()).toEqual({
      theme: "dark",
      locale: "fr",
    });
  });

  it("does not touch any sale when nobody is logged in", async () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    const dataProvider = createProvider();

    expect(await dataProvider.getPreferences()).toEqual({});

    await dataProvider.updatePreferences({ theme: "dark" });

    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(DEFAULT_USER));
    expect(await dataProvider.getPreferences()).toEqual({});
  });
});
