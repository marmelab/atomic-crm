import { Clock } from "lucide-react";
import { useTranslate } from "ra-core";
import { useIsMobile } from "@/hooks/use-mobile";

import { ActivityLog } from "../activity/ActivityLog";
import { DashboardCard } from "./DashboardCard";

export function DashboardActivityLog() {
  const isMobile = useIsMobile();
  const translate = useTranslate();

  if (isMobile) {
    return <ActivityLog pageSize={10} />;
  }

  return (
    <DashboardCard
      title={translate("crm.dashboard.latest_activity", {
        _: "Senaste aktivitet",
      })}
      icon={Clock}
    >
      <ActivityLog pageSize={10} />
    </DashboardCard>
  );
}
