import { RecordsIterator, useLocaleState, useTranslate } from "ra-core";
import { Link } from "react-router";
import { NumberField } from "@/components/admin/number-field";
import { SelectField } from "@/components/admin/select-field";

import { formatRelativeDate } from "../misc/RelativeDate";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";

type DealsIteratorDisplay = "normal" | "small";

/**
 * Renders the deals of the current ListContext as links to the deal.
 *
 * Two display modes: "normal" for a full-width page section (company show), and
 * "small" for the narrow contact aside, which drops the last activity column.
 */
export const DealsIterator = ({
  display = "normal",
}: {
  display?: DealsIteratorDisplay;
}) => (
  <RecordsIterator<Deal>
    render={(deal) => <DealRow deal={deal} display={display} />}
  />
);

const classes: Record<
  DealsIteratorDisplay,
  { row: string; name: string; meta: string }
> = {
  normal: {
    row: "flex items-center justify-between text-sm hover:bg-muted py-2 px-4 transition-colors",
    name: "font-medium",
    meta: "text-sm text-muted-foreground",
  },
  small: {
    row: "flex items-center justify-between gap-2 -mx-1 px-1 py-2 rounded-sm hover:bg-muted transition-colors",
    name: "font-medium truncate",
    meta: "text-xs text-muted-foreground truncate",
  },
};

const DealRow = ({
  deal,
  display,
}: {
  deal: Deal;
  display: DealsIteratorDisplay;
}) => {
  const translate = useTranslate();
  const [locale = "en"] = useLocaleState();
  const { dealCategories, dealStages, currency } = useConfigurationContext();
  const className = classes[display];

  return (
    <Link to={`/deals/${deal.id}/show`} className={className.row}>
      <div className="flex-1 min-w-0">
        <div className={className.name}>{deal.name}</div>
        <div className={className.meta}>
          <SelectField
            source="stage"
            choices={dealStages}
            optionText="label"
            optionValue="value"
          />
          {", "}
          <NumberField
            source="amount"
            options={{
              notation: "compact",
              style: "currency",
              currency,
              currencyDisplay: "narrowSymbol",
              minimumSignificantDigits: 3,
            }}
          />
          {deal.category && ", "}
          <SelectField
            source="category"
            choices={dealCategories}
            optionText="label"
            optionValue="value"
          />
        </div>
      </div>
      {display === "normal" && (
        <div className="text-right">
          <div className="text-sm text-muted-foreground">
            {translate("crm.common.last_activity_with_date", {
              date: formatRelativeDate(deal.updated_at, locale),
            })}
          </div>
        </div>
      )}
    </Link>
  );
};
