import { DollarSign } from "lucide-react";
import { useGetIdentity, useGetList } from "ra-core";
import { Link } from "react-router";
import { ReferenceField } from "@/components/admin/reference-field";
import { Card } from "@/components/ui/card";

import { SimpleList } from "../simple-list/SimpleList";
import { CompanyAvatar } from "../companies/CompanyAvatar";
import { findDealLabel } from "../deals/deal";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";

/**
 * This component displays the deals pipeline for the current user.
 * It's currently not used in the application but can be added to the dashboard.
 */
export const DealsPipeline = () => {
  const { identity } = useGetIdentity();
  const { dealStages, dealPipelineStatuses } = useConfigurationContext();
  const { data, total, isPending } = useGetList<Deal>(
    "deals",
    {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "last_seen", order: "DESC" },
      filter: { "stage@neq": "lost", sales_id: identity?.id },
    },
    { enabled: Number.isInteger(identity?.id) },
  );

  const getOrderedDeals = (data?: Deal[]): Deal[] | undefined => {
    if (!data) {
      return;
    }
    const deals: Deal[] = [];
    dealStages
      .filter((stage) => !dealPipelineStatuses.includes(stage.value))
      .forEach((stage) =>
        data
          .filter((deal) => deal.stage === stage.value)
          .forEach((deal) => deals.push(deal)),
      );
    return deals;
  };

  return (
    <>
      <div className="flex items-center mb-4">
        <div className="ml-8 mr-8 flex">
          <DollarSign className="text-muted-foreground w-6 h-6" />
        </div>
        <Link
          className="text-xl font-semibold text-muted-foreground hover:underline"
          to="/deals"
        >
          Deals Pipeline
        </Link>
      </div>
      <Card>
        <SimpleList<Deal>
          resource="deals"
          linkType="show"
          data={getOrderedDeals(data)}
          total={total}
          isPending={isPending}
          primaryText={(deal) => deal.name}
          secondaryText={(deal) =>
            `${deal.amount.toLocaleString("en-US", {
              notation: "compact",
              style: "currency",
              currency: "USD",
              currencyDisplay: "narrowSymbol",
              minimumSignificantDigits: 3,
            })} , ${findDealLabel(dealStages, deal.stage)}`
          }
          leftAvatar={(deal) => (
            <ReferenceField
              source="company_id"
              record={deal}
              reference="companies"
              resource="deals"
              link={false}
            >
              <CompanyAvatar width={20} height={20} />
            </ReferenceField>
          )}
        />
      </Card>
    </>
  );
};
