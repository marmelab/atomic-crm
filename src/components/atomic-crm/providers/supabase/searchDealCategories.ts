import type { DataProvider, GetListParams } from "ra-core";

import { defaultDealCategories } from "../../root/defaultConfiguration";
import type { LabeledValue } from "../../types";

/**
 * ilike can't search inside the categories array, so the search words are
 * matched against the configured category labels and values instead, and the
 * matching categories are added to the full-text search as an overlap filter.
 */
export const searchDealCategories = async (
  params: GetListParams,
  q: string | undefined,
  dataProvider: DataProvider,
): Promise<GetListParams> => {
  if (!q) return params;
  // One configuration per business; RLS returns the current business one
  const { data } = await dataProvider.getList("configuration", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
    filter: {},
  });
  const categories: LabeledValue[] =
    data?.[0]?.config?.dealCategories ?? defaultDealCategories;
  const words = q.toLowerCase().trim().split(/\s+/);
  const matches = categories.filter(({ value, label }) =>
    words.some(
      (word) =>
        value.toLowerCase().includes(word) ||
        label.toLowerCase().includes(word),
    ),
  );
  if (matches.length === 0) return params;
  return {
    ...params,
    filter: {
      ...params.filter,
      "@or": {
        ...params.filter["@or"],
        "categories@ov": `{${matches.map(({ value }) => `"${value}"`).join(",")}}`,
      },
    },
  };
};
