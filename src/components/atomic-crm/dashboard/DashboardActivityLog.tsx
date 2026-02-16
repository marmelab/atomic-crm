import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

import { ActivityLog } from "../activity/ActivityLog";

export function DashboardActivityLog() {
  const isMobile = useIsMobile();
  return (
    <div className="flex flex-col border border-border rounded-xl p-4 bg-card">
      <div className="flex items-center pb-3 mb-4 border-b border-border">
        <div className="mr-3 flex">
          <Clock className="text-muted-foreground w-5 h-5" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Latest Activity
        </h2>
      </div>
      {isMobile ? (
        <ActivityLog pageSize={10} />
      ) : (
        <div className="px-2">
          <ActivityLog pageSize={10} />
        </div>
      )}
    </div>
  );
}
