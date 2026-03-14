import { InfiniteListBase } from "ra-core";
import type { Identifier } from "ra-core";

import { ActivityLogContext } from "./ActivityLogContext";
import { ActivityLogIterator } from "./ActivityLogIterator";

type ActivityLogProps = {
  companyId?: Identifier;
  pageSize?: number;
  context?: "company" | "contact" | "deal" | "all";
};

export function ActivityLog({
  companyId,
  pageSize = 20,
  context = "all",
}: ActivityLogProps) {
  return (
    <ActivityLogContext.Provider value={context}>
      <InfiniteListBase
        resource="activity_log"
        filter={companyId ? { company_id: companyId } : {}}
        sort={{ field: "date", order: "DESC" }}
        perPage={pageSize}
        disableSyncWithLocation
      >
        <ActivityLogIterator />
      </InfiniteListBase>
    </ActivityLogContext.Provider>
  );
}
