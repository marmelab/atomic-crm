import { describe, expect, it } from "vitest";

import type { Db } from "./dataGenerator/types";
import { createCrmDb } from "@/test/StoryWrapper";
import { DEFAULT_USER, USER_STORAGE_KEY } from "./authProvider";
import { createDataProvider } from "./dataProvider";

const createProvider = () =>
  createDataProvider({ db: createCrmDb(), latency: 0, silent: true });

describe("fakerest dataProvider", () => {
  it("removes a deleted tag from contacts without touching other fields", async () => {
    const lastSeen = "2020-01-01T00:00:00.000Z";
    const dataProvider = createDataProvider({
      db: {
        tags: [
          { id: 1, name: "vip", color: "#fff" },
          { id: 2, name: "lead", color: "#000" },
        ],
        contacts: [
          { id: 1, first_name: "Ann", tags: [1, 2], last_seen: lastSeen },
          { id: 2, first_name: "Bob", tags: [2], last_seen: lastSeen },
        ],
      } as unknown as Db,
      latency: 0,
      silent: true,
    });

    await dataProvider.delete("tags", { id: 1 });

    const { data: contacts } = await dataProvider.getMany("contacts", {
      ids: [1, 2],
    });
    expect(contacts.map((c) => c.tags)).toEqual([[2], [2]]);
    expect(contacts.map((c) => c.last_seen)).toEqual([lastSeen, lastSeen]);
  });

  it("ignores unknown ids when getting many tags", async () => {
    const dataProvider = createDataProvider({
      db: { tags: [{ id: 2, name: "lead", color: "#000" }] } as unknown as Db,
      latency: 0,
      silent: true,
    });

    const { data: tags } = await dataProvider.getMany("tags", { ids: [1, 2] });

    expect(tags.map((tag) => tag.id)).toEqual([2]);
  });
});

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

  it("refuses to write, and touches no sale, when nobody is logged in", async () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    const dataProvider = createProvider();

    expect(await dataProvider.getPreferences()).toEqual({});

    await expect(
      dataProvider.updatePreferences({ theme: "dark" }),
    ).rejects.toThrow();

    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(DEFAULT_USER));
    expect(await dataProvider.getPreferences()).toEqual({});
  });

  it("returns a validated value, so a corrupt stored theme cannot reach the UI", async () => {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(DEFAULT_USER));
    const db = structuredClone(createCrmDb());
    db.sales[0].preferences = { theme: "a b" } as never;
    const dataProvider = createDataProvider({ db, latency: 0, silent: true });

    expect(await dataProvider.updatePreferences({ locale: "fr" })).toEqual({
      locale: "fr",
    });
  });
});
