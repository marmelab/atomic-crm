import { ChevronDown, ChevronRight, Clock } from "lucide-react";
import { useGetList, useTranslate } from "ra-core";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

import { ActivityLog } from "../activity/ActivityLog";

// Kept as reference/history, but deliberately secondary: collapsed by
// default so it never competes with Tasks or Business at a Glance for
// attention. Expanding renders the same ActivityLog used elsewhere —
// nothing about the underlying activity feed changes.
export function DashboardActivityLog() {
  const isMobile = useIsMobile();
  const translate = useTranslate();
  const [expanded, setExpanded] = useState(false);
  const { total } = useGetList("activity_log", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "date", order: "DESC" },
  });

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex items-center gap-2 mb-2 cursor-pointer text-left"
        aria-expanded={expanded}
      >
        <Clock className="text-muted-foreground w-4 h-4" />
        <h2 className="text-sm font-semibold text-muted-foreground">
          {translate("crm.dashboard.latest_activity", {
            _: "Latest Activity",
          })}
          {total != null ? ` (${total})` : ""}
        </h2>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {expanded &&
        (isMobile ? (
          <ActivityLog pageSize={10} />
        ) : (
          <Card className="mb-2 p-6">
            <ActivityLog pageSize={10} />
          </Card>
        ))}
    </div>
  );
}
