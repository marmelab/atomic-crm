import { Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ActivityLog } from "../activity/ActivityLog";

export function DashboardActivityLog() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <Clock className="text-muted-foreground h-5 w-5" />
          <CardTitle className="text-lg font-semibold">
            Latest Activity
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ActivityLog pageSize={10} />
      </CardContent>
    </Card>
  );
}
