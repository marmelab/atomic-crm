import { Building2, ChevronRight, Clock } from "lucide-react";
import { ResourceContextProvider, useGetIdentity, useGetList } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { SimpleList } from "../simple-list/SimpleList";
import type { Company } from "../types";
import {
  getFollowupRelativeLabel,
  getFollowupUrgency,
  getFollowupUrgencyColor,
  getNextActionTypeLabel,
} from "../companies/followupUtils";
import { DashboardCard } from "./DashboardCard";

export const FollowUpsDueToday = () => {
  const { identity } = useGetIdentity();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const endOfTodayISO = endOfToday.toISOString();

  const {
    data: companies,
    total,
    isPending,
  } = useGetList<Company>(
    "companies",
    {
      pagination: { page: 1, perPage: 20 },
      sort: { field: "next_followup_date", order: "ASC" },
      filter: {
        "next_followup_date@lte": endOfTodayISO,
        "next_followup_date@not.is": null,
      },
    },
    { enabled: Number.isInteger(identity?.id) },
  );

  return (
    <DashboardCard
      title="Uppföljningar idag"
      icon={Clock}
      action={
        total != null && total > 0 ? (
          <Badge variant="destructive">{total}</Badge>
        ) : undefined
      }
      contentClassName="p-0"
    >
      <ResourceContextProvider value="companies">
        <SimpleList<Company>
          data={companies}
          total={total}
          isPending={isPending}
          primaryText={(company) => company.name}
          secondaryText={(company) => {
            const label = getFollowupRelativeLabel(company.next_followup_date);
            const actionType = company.next_action_type
              ? getNextActionTypeLabel(company.next_action_type)
              : null;
            const note = company.next_action_note;
            const parts = [label, actionType, note].filter(Boolean);
            return parts.join(" · ");
          }}
          leftIcon={(company) => {
            const urgency = getFollowupUrgency(company.next_followup_date);
            const colorClass = getFollowupUrgencyColor(urgency);
            return (
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${colorClass}`}
              >
                <Building2 className="w-4 h-4" />
              </div>
            );
          }}
          rightIcon={() => (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          linkType={(record) => `/companies/${record.id}/show`}
          empty={
            <div className="p-4 text-sm text-muted-foreground text-center">
              Inga uppföljningar idag
            </div>
          }
        />
      </ResourceContextProvider>
    </DashboardCard>
  );
};
