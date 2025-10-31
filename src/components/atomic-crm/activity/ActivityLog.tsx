import { Alert } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { type Identifier, useDataProvider } from "ra-core";

import type { CrmDataProvider } from "../providers/types";
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
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { data, isPending, error } = useQuery({
    queryKey: ["activityLog", companyId],
    queryFn: () => dataProvider.getActivityLog(companyId),
  });

  if (isPending) {
    return (
      <div className="mt-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="space-y-2 mt-1" key={index}>
            <div className="flex flex-row space-x-2 items-center">
              <Skeleton className="w-5 h-5 rounded-full" />
              <Skeleton className="w-full h-4" />
            </div>
            <Skeleton className="w-full h-12" />
            <Separator />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <Alert>Failed to load activity log</Alert>;
  }

  return (
    <ActivityLogContext.Provider value={context}>
      <ActivityLogIterator activities={data} pageSize={pageSize} />
    </ActivityLogContext.Provider>
  );
}
