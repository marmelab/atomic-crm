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

  it("lists a task created in the app before older ones in the global search", async () => {
    const dataProvider = createDataProvider({
      db: {
        companies: [],
        contacts: [{ id: 1, first_name: "Ann", nb_tasks: 1 }],
        deals: [],
        contact_notes: [],
        deal_notes: [],
        tasks: [
          {
            id: 1,
            contact_id: 1,
            text: "Call back",
            created_at: "2020-01-01T00:00:00.000Z",
            done_date: null,
          },
        ],
      } as unknown as Db,
      latency: 0,
      silent: true,
    });

    await dataProvider.create("tasks", {
      data: { contact_id: 1, text: "Call again", done_date: null },
    });
    const results = await dataProvider.globalSearch("call", ["tasks"], 10);

    expect(results.map((result) => result.title)).toEqual([
      "Call again",
      "Call back",
    ]);
  });

  it("finds an old contact in the global search despite many newer notes mentioning them", async () => {
    const dataProvider = createDataProvider({
      db: {
        companies: [],
        contacts: [
          {
            id: 1,
            first_name: "Marc",
            last_name: "Durand",
            first_seen: "2021-03-01T00:00:00.000Z",
          },
        ],
        deals: [],
        tasks: [],
        contact_notes: Array.from({ length: 20 }, (_, index) => ({
          id: index + 1,
          contact_id: 1,
          text: `Called Marc about the renewal (${index})`,
          date: "2026-09-01T00:00:00.000Z",
          attachments: [],
        })),
        deal_notes: [],
      } as unknown as Db,
      latency: 0,
      silent: true,
    });

    const results = await dataProvider.globalSearch(
      "marc",
      ["contacts", "contact_notes"],
      10,
    );

    expect(
      results.filter((result) => result.resource === "contacts"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.resource === "contact_notes"),
    ).toHaveLength(10);
  });

  it("finds a deal in the global search by any of its categories", async () => {
    const dataProvider = createDataProvider({
      db: {
        companies: [],
        contacts: [],
        deals: [
          {
            id: 1,
            name: "Acme rebrand",
            categories: ["copywriting", "design"],
            description: "New logo",
          },
          { id: 2, name: "Design review", description: "No categories" },
        ],
        tasks: [],
        contact_notes: [],
        deal_notes: [],
      } as unknown as Db,
      latency: 0,
      silent: true,
    });

    const copyResults = await dataProvider.globalSearch("copy", ["deals"], 10);
    const designResults = await dataProvider.globalSearch(
      "design",
      ["deals"],
      10,
    );

    expect(copyResults.map((result) => result.content)).toEqual([
      "copywriting · design · New logo",
    ]);
    expect(designResults.map((result) => result.title).sort()).toEqual([
      "Acme rebrand",
      "Design review",
    ]);
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

  it("follows the injected authProvider identity when localStorage holds no user", async () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    const db = structuredClone(createCrmDb());
    db.sales.push({ ...db.sales[0], id: 7, preferences: undefined });
    const dataProvider = createDataProvider({
      db,
      latency: 0,
      silent: true,
      authProvider: { getIdentity: async () => ({ id: 7 }) },
    });

    await dataProvider.updatePreferences({ theme: "dark" });

    expect(await dataProvider.getPreferences()).toEqual({ theme: "dark" });
    const { data: otherSale } = await dataProvider.getOne("sales", {
      id: DEFAULT_USER.id,
    });
    expect(otherSale.preferences).toBeUndefined();
  });

  it("refuses to write, and touches no sale, when the authProvider has no identity", async () => {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(DEFAULT_USER));
    const dataProvider = createDataProvider({
      db: createCrmDb(),
      latency: 0,
      silent: true,
      authProvider: {
        getIdentity: async () => {
          throw new Error("Not authenticated");
        },
      },
    });

    await expect(
      dataProvider.updatePreferences({ theme: "dark" }),
    ).rejects.toThrow();

    const { data: sale } = await dataProvider.getOne("sales", {
      id: DEFAULT_USER.id,
    });
    expect(sale.preferences).toBeUndefined();
  });

  it("refuses to write, and touches no sale, when the default authProvider has no stored user", async () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    const dataProvider = createProvider();

    await expect(
      dataProvider.updatePreferences({ theme: "dark" }),
    ).rejects.toThrow();

    const { data: sale } = await dataProvider.getOne("sales", {
      id: DEFAULT_USER.id,
    });
    expect(sale.preferences).toBeUndefined();
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
