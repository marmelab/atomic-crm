import { Building2 } from "lucide-react";
import {
  RecordContextProvider,
  useGetMany,
  useListContext,
  useTranslate,
} from "ra-core";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company, Deal } from "../types";
import { findDealLabel } from "./dealUtils";
import {
  groupDealsByCompany,
  type DealCompanyGroup,
} from "./groupDealsByCompany";

/** Deals page view listing the deals grouped under their company. */
export const DealCompanyView = () => {
  const { data: deals = [], isPending } = useListContext<Deal>();
  const companyIds = [
    ...new Set(deals.map((deal) => deal.company_id).filter((id) => id != null)),
  ];
  const { data: companies = [], isPending: isCompaniesPending } =
    useGetMany<Company>("companies", { ids: companyIds });

  if (isPending || (companyIds.length > 0 && isCompaniesPending)) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groupDealsByCompany(deals, companies).map((group) => (
        <CompanyDealGroup key={String(group.companyId)} group={group} />
      ))}
    </div>
  );
};

const CompanyDealGroup = ({ group }: { group: DealCompanyGroup }) => {
  const translate = useTranslate();
  const { currency } = useConfigurationContext();

  return (
    <Card className="p-0 gap-0 overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-muted/40">
        {group.company ? (
          <RecordContextProvider value={group.company}>
            <Link
              to={`/companies/${group.company.id}/show`}
              className="flex items-center gap-3 font-semibold hover:underline"
            >
              <CompanyAvatar width={20} height={20} />
              {group.company.name}
            </Link>
          </RecordContextProvider>
        ) : (
          <span className="flex items-center gap-3 font-semibold text-muted-foreground">
            <Building2 className="w-5 h-5" />
            {translate("resources.deals.no_company", { _: "No company" })}
          </span>
        )}
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {translate("resources.companies.nb_deals", {
            smart_count: group.deals.length,
          })}{" "}
          ·{" "}
          {group.totalAmount.toLocaleString("en-US", {
            notation: "compact",
            style: "currency",
            currency,
            currencyDisplay: "narrowSymbol",
          })}
        </span>
      </div>
      <ul className="divide-y">
        {group.deals.map((deal) => (
          <DealRow key={deal.id} deal={deal} />
        ))}
      </ul>
    </Card>
  );
};

const DealRow = ({ deal }: { deal: Deal }) => {
  const { dealStages, currency } = useConfigurationContext();
  return (
    <li>
      <Link
        to={`/deals/${deal.id}/show`}
        className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm hover:bg-muted transition-colors"
      >
        <span className="flex-1 min-w-40 font-medium truncate">
          {deal.name}
        </span>
        <Badge variant="outline">
          {findDealLabel(dealStages, deal.stage) ?? deal.stage}
        </Badge>
        <span className="w-20 text-right tabular-nums">
          {typeof deal.amount === "number"
            ? deal.amount.toLocaleString("en-US", {
                notation: "compact",
                style: "currency",
                currency,
                currencyDisplay: "narrowSymbol",
              })
            : "—"}
        </span>
      </Link>
    </li>
  );
};
