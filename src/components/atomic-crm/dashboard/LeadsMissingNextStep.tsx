import { AlertTriangle, Building2, ChevronRight } from "lucide-react";
import { ResourceContextProvider, useGetIdentity, useGetList } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { SimpleList } from "../simple-list/SimpleList";
import type { Company } from "../types";
import { DashboardCard } from "./DashboardCard";

export const LeadsMissingNextStep = () => {
  const { identity } = useGetIdentity();
  const {
    data: companies,
    total,
    isPending,
  } = useGetList<Company>(
    "companies",
    {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "last_touch_at", order: "ASC" },
      filter: {
        "data_quality_status@eq": "missing_next_step",
      },
    },
    { enabled: Number.isInteger(identity?.id) },
  );

  return (
    <DashboardCard
      title="Leads utan nästa steg"
      icon={AlertTriangle}
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
          secondaryText={(company) =>
            company.lead_status
              ? leadStatusLabel(company.lead_status)
              : "Ingen status"
          }
          leftIcon={() => (
            <Building2 className="w-5 h-5 text-muted-foreground" />
          )}
          rightIcon={() => (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          linkType={(record) => `/companies/${record.id}/show`}
          empty={
            <div className="p-4 text-sm text-muted-foreground text-center">
              Alla leads har ett planerat nästa steg
            </div>
          }
        />
      </ResourceContextProvider>
    </DashboardCard>
  );
};

const leadStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    new: "Ny",
    contacted: "Kontaktad",
    interested: "Intresserad",
    callback_requested: "Ring upp igen",
    meeting_booked: "Möte bokat",
    not_interested: "Inte intresserad",
    proposal_sent: "Offert skickad",
    negotiation: "Förhandling",
    closed_won: "Vunnen",
    closed_lost: "Förlorad",
    bad_fit: "Dålig match",
  };
  return labels[status] || status;
};
