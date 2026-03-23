import { useGetList } from "ra-core";

import type { Tag } from "../types";

type UseTagsOptions = {
  enabled?: boolean;
  perPage?: number;
};

export function useTags({ enabled, perPage = 1000 }: UseTagsOptions = {}) {
  return useGetList<Tag>(
    "tags",
    {
      pagination: { page: 1, perPage },
      sort: { field: "name", order: "ASC" },
    },
    { enabled },
  );
}
