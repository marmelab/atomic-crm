import { useListContext } from "ra-core";
import { Link } from "react-router";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { findDealLabel } from "./dealUtils";

/**
 * A Contact's opportunity history — every Opportunity ever linked to this
 * Contact, active or not (Won ones included, since they no longer show on
 * the active Kanban board but still belong to this Contact's history).
 */
export const OpportunitiesIterator = () => {
  const { data, error, isPending } = useListContext<Deal>();
  const { dealStages, currency } = useConfigurationContext();
  if (isPending || error || data.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {data.map((deal) => (
        <Link
          key={deal.id}
          to={`/deals/${deal.id}/show`}
          className="flex items-center justify-between gap-2 text-sm hover:underline"
        >
          {/* Contact identity is implied by being on their own page already;
              the Offer is what actually differentiates entries in this list. */}
          <span className="truncate">
            {deal.offer_name_snapshot ?? deal.name}
          </span>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {findDealLabel(dealStages, deal.stage)}
            {" · "}
            {deal.amount.toLocaleString("en-US", {
              notation: "compact",
              style: "currency",
              currency,
              currencyDisplay: "narrowSymbol",
              minimumSignificantDigits: 3,
            })}
          </span>
        </Link>
      ))}
    </div>
  );
};
