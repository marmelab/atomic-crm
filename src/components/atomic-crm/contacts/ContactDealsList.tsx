import {
  ListBase,
  RecordContextProvider,
  useListContext,
  useRecordContext,
} from "ra-core";
import { Link } from "react-router";
import { NumberField } from "@/components/admin/number-field";
import { SelectField } from "@/components/admin/select-field";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact, Deal } from "../types";

/**
 * The deals the current contact is attached to.
 *
 * Deals reference contacts through the `contact_ids` array column, so this filters
 * with the `@cs` (contains) operator instead of using a ReferenceManyField: the
 * postgrest provider always builds `getManyReference` targets as `<target>=eq.<id>`,
 * which an array column cannot match.
 */
export const ContactDealsList = () => {
  const contact = useRecordContext<Contact>();

  if (!contact) return null;

  return (
    <ListBase
      resource="deals"
      filter={{
        "contact_ids@cs": `{${contact.id}}`,
        "archived_at@is": null,
      }}
      sort={{ field: "updated_at", order: "DESC" }}
      perPage={25}
      disableSyncWithLocation
      storeKey={false}
    >
      <DealsIterator />
    </ListBase>
  );
};

const DealsIterator = () => {
  const { data, error, isPending } = useListContext<Deal>();
  const { dealStages, currency } = useConfigurationContext();

  if (isPending || error || !data?.length) return null;

  return (
    <div className="flex flex-col">
      {data.map((deal) => (
        <RecordContextProvider key={deal.id} value={deal}>
          <Link
            to={`/deals/${deal.id}/show`}
            className="flex flex-col -mx-1 px-1 py-1 rounded-sm hover:bg-muted transition-colors"
          >
            <span className="font-medium">{deal.name}</span>
            <span className="text-xs text-muted-foreground">
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
            </span>
          </Link>
        </RecordContextProvider>
      ))}
    </div>
  );
};
