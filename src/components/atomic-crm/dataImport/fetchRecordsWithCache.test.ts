import type { DataProvider } from "ra-core";
import { describe, expect, it, vi } from "vitest";

import { fetchRecordsWithCache } from "./fetchRecordsWithCache";

type Company = { id: number; name: string };

const makeDataProvider = (records: Company[]) => {
  let nextId = 100;
  return {
    getList: vi.fn(async (_resource, { filter, pagination, sort }) => {
      const names = filter["name@in"]
        .slice(1, -1)
        .split(",")
        .map((name: string) => name.slice(1, -1));
      const matches = records
        .filter((record) => names.includes(record.name))
        .sort((a, b) => (sort.order === "ASC" ? a.id - b.id : b.id - a.id));
      const start = (pagination.page - 1) * pagination.perPage;
      return {
        data: matches.slice(start, start + pagination.perPage),
        total: matches.length,
      };
    }),
    create: vi.fn(async (_resource, { data }) => ({
      data: { id: nextId++, ...data },
    })),
  } as unknown as DataProvider;
};

describe("fetchRecordsWithCache", () => {
  it("finds existing records when another name has duplicates", async () => {
    const dataProvider = makeDataProvider([
      { id: 1, name: "Acme" },
      { id: 2, name: "Acme" },
      { id: 3, name: "Beta" },
    ]);

    const records = await fetchRecordsWithCache<Company>(
      "companies",
      new Map(),
      ["Acme", "Beta"],
      (name) => ({ name }),
      dataProvider,
    );

    expect(dataProvider.create).not.toHaveBeenCalled();
    expect(records.get("Acme")?.id).toBe(1);
    expect(records.get("Beta")?.id).toBe(3);
  });
});
