import { useCallback } from "react";
import { useDataProvider } from "ra-core";

import type { Tag } from "../types";

export function useCreateTag() {
  const dataProvider = useDataProvider();

  return useCallback(
    async (data: Pick<Tag, "name" | "color">) => {
      const response = await dataProvider.create<Tag>("tags", { data });
      return response.data;
    },
    [dataProvider],
  );
}
