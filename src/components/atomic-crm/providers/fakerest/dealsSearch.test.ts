import { buildDeal, createCrmDb } from "@/test/StoryWrapper";

import { createDataProvider } from "./dataProvider";

const dealCategories = [
  { value: "website-design", label: "Site building" },
  { value: "copywriting", label: "Copywriting" },
];

const getDealNames = async (filter: Record<string, unknown>) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      deals: [
        buildDeal({
          id: 1,
          name: "Site",
          category_amounts: [{ category: "website-design", amount: 800 }],
        }),
        buildDeal({
          id: 2,
          name: "Blog",
          category_amounts: [{ category: "copywriting", amount: 300 }],
        }),
        buildDeal({
          id: 3,
          name: "Site and blog",
          category_amounts: [
            { category: "website-design", amount: 800 },
            { category: "copywriting", amount: 300 },
          ],
        }),
      ],
    }),
    latency: 0,
    silent: true,
  });
  const { data } = await dataProvider.getList("deals", {
    filter,
    pagination: { page: 1, perPage: 10 },
    sort: { field: "id", order: "ASC" },
    meta: { dealCategories },
  });
  return data.map((deal) => deal.name);
};

describe("FakeRest deals getList", () => {
  it("finds a deal by the label of its category", async () => {
    expect(await getDealNames({ q: "building" })).toEqual([
      "Site",
      "Site and blog",
    ]);
  });

  it("ignores a trailing space after a category label", async () => {
    expect(await getDealNames({ q: "building " })).toEqual([
      "Site",
      "Site and blog",
    ]);
  });

  it("ignores a doubled space when no category matches", async () => {
    expect(await getDealNames({ q: "blog  launch" })).toEqual([
      "Blog",
      "Site and blog",
    ]);
  });

  it("ignores a doubled space between words", async () => {
    expect(await getDealNames({ q: "site  building" })).toEqual([
      "Site",
      "Site and blog",
    ]);
  });

  it("applies a stale single-category filter as a categories filter", async () => {
    expect(await getDealNames({ category: "copywriting" })).toEqual([
      "Blog",
      "Site and blog",
    ]);
  });

  it("keeps the deals having all the categories of the filter", async () => {
    expect(
      await getDealNames({ "categories@cs": "{website-design,copywriting}" }),
    ).toEqual(["Site and blog"]);
  });

  it("returns no deal when none has all the categories", async () => {
    expect(await getDealNames({ "categories@cs": "{other}" })).toEqual([]);
  });
});
