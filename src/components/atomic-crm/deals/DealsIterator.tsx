import { RecordsIterator, useLocaleState, useTranslate } from "ra-core";
import { Link } from "react-router";
import { NumberField } from "@/components/admin/number-field";
import { SelectField } from "@/components/admin/select-field";

import { formatRelativeDate } from "../misc/RelativeDate";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";

/**
 * Renders the deals of the current ListContext as links to the deal.
 *
 * Used wherever a list of deals is shown outside the deals board: the company
 * show page and the contact aside.
 */
export const DealsIterator = ({
  showLastActivity,
}: {
  showLastActivity?: boolean;
}) => (
  <RecordsIterator<Deal>
    render={(deal) => (
      <DealRow deal={deal} showLastActivity={showLastActivity} />
    )}
  />
);

const DealRow = ({
  deal,
  showLastActivity,
}: {
  deal: Deal;
  showLastActivity?: boolean;
}) => {
  const translate = useTranslate();
  const [locale = "en"] = useLocaleState();
  const { dealCategories, dealStages, currency } = useConfigurationContext();

  return (
    <Link
      to={`/deals/${deal.id}/show`}
      className="flex items-center justify-between gap-2 -mx-1 px-1 py-2 rounded-sm hover:bg-muted transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{deal.name}</div>
        <div className="text-xs text-muted-foreground truncate">
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
      {showLastActivity && (
        <div className="text-xs text-muted-foreground text-right">
          {translate("crm.common.last_activity_with_date", {
            date: formatRelativeDate(deal.updated_at, locale),
          })}
        </div>
      )}
    </Link>
  );
};
