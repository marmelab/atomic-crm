import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";

import { ActivityLog } from "../activity/ActivityLog";

export function DashboardActivityLog() {
  return (
    <div className="flex flex-col">
      <div className="flex items-center mb-2">
        <div className="mr-3 flex">
          <Clock className="text-muted-foreground w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-muted-foreground">
          Latest Activity
        </h2>
      </div>
      <Card className="mb-2 p-6">
        <ActivityLog pageSize={10} />
      </Card>
    </div>
  );
}
