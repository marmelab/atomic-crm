import type { GetListParams } from "ra-core";

import {
  findDealCategoriesMatching,
  mapLegacyCategoryFilter,
} from "../../deals/dealUtils";

export const applyFullTextSearch =
  (columns: string[]) => (params: GetListParams) => {
    if (!params.filter?.q) {
      return params;
    }
    const { q, ...filter } = params.filter;
    return {
      ...params,
      filter: {
        ...filter,
        "@or": columns.reduce((acc, column) => {
          if (column === "email")
            return {
              ...acc,
              [`email_fts@ilike`]: q,
            };
          if (column === "phone")
            return {
              ...acc,
              [`phone_fts@ilike`]: q,
            };
          else
            return {
              ...acc,
              [`${column}@ilike`]: q,
            };
        }, {}),
      },
    };
  };

/**
 * The deals list query: a search matches the name, the description, and the
 * categories whose label or value contains a word of it. Category labels live
 * in the frontend configuration, so DealList passes them in meta.
 */
export const getDealsListParams = (params: GetListParams): GetListParams => {
  const searched = applyFullTextSearch(["name", "description"])(
    mapLegacyCategoryFilter(params),
  );
  const categories = params.filter?.q
    ? findDealCategoriesMatching(
        params.meta?.dealCategories ?? [],
        params.filter.q,
      )
    : [];
  if (categories.length === 0) return searched;
  return {
    ...searched,
    filter: {
      ...searched.filter,
      "@or": {
        ...searched.filter["@or"],
        "categories@ov": `{${categories.join(",")}}`,
      },
    },
  };
};
