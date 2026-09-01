import type { DataProvider, Identifier } from "ra-core";

import type { Sale } from "../types";

// Same resolution as public-application/submitApplication.ts's own
// resolveDefaultTaskSalesId (duplicated there per that module's documented
// convention — different slice, different file). Shared once here across
// every sales-calls/*.ts module in THIS slice, since they're all new files
// introduced together: this app has exactly one real owner, the `sales`
// row with administrator: true, and a Task created with no sales_id never
// matches the Dashboard's own `sales_id: identity?.id` filter.
export const resolveDefaultTaskSalesId = async (
  dataProvider: DataProvider,
): Promise<Identifier | undefined> => {
  const { data: administrators } = await dataProvider.getList<Sale>("sales", {
    filter: { administrator: true },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  return administrators[0]?.id;
};
