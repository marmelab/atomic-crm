import { describe, expect, it } from "vitest";

import type { Db } from "./dataGenerator/types";
import { createDataProvider } from "./dataProvider";

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
});
