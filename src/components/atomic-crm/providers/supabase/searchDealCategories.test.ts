import type { DataProvider, GetListParams } from "ra-core";
import { describe, expect, it } from "vitest";

import { searchDealCategories } from "./searchDealCategories";

const dataProviderWithConfig = (config: object) =>
  ({
    getOne: async () => ({ data: { id: 1, config } }),
  }) as unknown as DataProvider;

const searchParams: GetListParams = {
  filter: { "@or": { "name@ilike": "design" } },
};

describe("searchDealCategories", () => {
  it("adds the categories whose label or value matches a search word", async () => {
    const dataProvider = dataProviderWithConfig({
      dealCategories: [
        { value: "ui-design", label: "UI Design" },
        { value: "web", label: "Website design" },
        { value: "print", label: "Print project" },
      ],
    });

    const result = await searchDealCategories(
      searchParams,
      "Design",
      dataProvider,
    );

    expect(result.filter["@or"]).toEqual({
      "name@ilike": "design",
      "categories@ov": '{"ui-design","web"}',
    });
  });

  it("falls back to the default categories when none are configured", async () => {
    const result = await searchDealCategories(
      searchParams,
      "copywriting",
      dataProviderWithConfig({}),
    );

    expect(result.filter["@or"]["categories@ov"]).toBe('{"copywriting"}');
  });

  it("leaves the search unchanged when no category matches", async () => {
    const result = await searchDealCategories(
      searchParams,
      "acme",
      dataProviderWithConfig({}),
    );

    expect(result).toBe(searchParams);
  });
});
