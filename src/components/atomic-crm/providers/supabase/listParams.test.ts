import { getDealsListParams } from "./listParams";

const dealCategories = [
  { value: "website-design", label: "Site building" },
  { value: "copywriting", label: "Copywriting" },
];

const listParams = (filter: Record<string, unknown>) => ({
  filter,
  pagination: { page: 1, perPage: 10 },
  sort: { field: "id", order: "ASC" as const },
  meta: { dealCategories },
});

describe("getDealsListParams", () => {
  it("searches the name, the description and the categories whose label matches", () => {
    expect(getDealsListParams(listParams({ q: "building" })).filter).toEqual({
      "@or": {
        "name@ilike": "building",
        "description@ilike": "building",
        "categories@ov": "{website-design}",
      },
    });
  });

  it("searches only the text fields when no category matches", () => {
    expect(getDealsListParams(listParams({ q: "launch" })).filter).toEqual({
      "@or": { "name@ilike": "launch", "description@ilike": "launch" },
    });
  });

  it("maps a stale single-category filter to the categories filter", () => {
    expect(
      getDealsListParams(listParams({ category: "copywriting", stage: "won" }))
        .filter,
    ).toEqual({ "categories@cs": "{copywriting}", stage: "won" });
  });
});
