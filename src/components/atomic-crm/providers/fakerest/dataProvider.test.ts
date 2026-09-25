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
});
