import { CalendarDays } from "lucide-react";
import { useGetList, useTranslate } from "ra-core";

import { CalendarAgenda } from "../calendar/CalendarAgenda";
import type { CalendarEvent } from "../calendar/types";
import { DashboardCard } from "./DashboardCard";

const isUpcoming = (event: CalendarEvent) => {
  if (event.status === "cancelled") {
    return false;
  }
  return new Date(event.starts_at).getTime() >= Date.now();
};

export const UpcomingMeetings = () => {
  const translate = useTranslate();
  const { data, isPending } = useGetList<CalendarEvent>("calendar_events", {
    pagination: { page: 1, perPage: 10 },
    sort: { field: "starts_at", order: "ASC" },
  });

  const events = (data ?? []).filter(isUpcoming);

  return (
    <DashboardCard
      title={translate("crm.dashboard.upcoming_meetings")}
      icon={CalendarDays}
    >
      <CalendarAgenda events={events} isPending={isPending} compact />
    </DashboardCard>
  );
};
