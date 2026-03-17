import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

import { ActivityLog } from "../activity/ActivityLog";

export function DashboardActivityLog() {
  const isMobile = useIsMobile();
  return (
    <div className="flex flex-col">
      <div className="flex items-center mb-3 md:mb-2">
        <div className="mr-3 flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--nosho-teal)]/10">
          <Clock className="text-[var(--nosho-teal)] w-4 h-4" />
        </div>
        <h2 className="text-base font-semibold text-muted-foreground">
          Activité récente
        </h2>
      </div>
      {isMobile ? (
        <ActivityLog pageSize={10} />
      ) : (
        <Card className="mb-2 p-5 shadow-sm border-border/50">
          <ActivityLog pageSize={10} />
        </Card>
      )}
    </div>
  );
}
