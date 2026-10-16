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
  const { data } = await dataProvider.getOne("configuration", { id: 1 });
  const categories: LabeledValue[] =
    data?.config?.dealCategories ?? defaultDealCategories;
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
