import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { type Identifier, useDataProvider } from "ra-core";
import { RotateCcw } from "lucide-react";

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
  const { data, isPending, error, refetch } = useQuery({
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
    return (
      <div className="p-4">
        <div className="text-center text-muted-foreground mb-4">
          Error loading latest activity
        </div>
        <div className="text-center mt-2">
          <Button
            onClick={() => {
              refetch();
            }}
          >
            <RotateCcw />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ActivityLogContext.Provider value={context}>
      <ActivityLogIterator activities={data} pageSize={pageSize} />
    </ActivityLogContext.Provider>
  );
}
