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
        buildDeal({ id: 1, name: "Site", categories: ["website-design"] }),
        buildDeal({ id: 2, name: "Blog", categories: ["copywriting"] }),
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
    expect(await getDealNames({ q: "building" })).toEqual(["Site"]);
  });

  it("applies a stale single-category filter as a categories filter", async () => {
    expect(await getDealNames({ category: "copywriting" })).toEqual(["Blog"]);
  });
});
