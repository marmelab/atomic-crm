import { ListBase, useRecordContext } from "ra-core";

import { DealsIterator } from "../deals/DealsIterator";
import type { Contact } from "../types";

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
      loading={null}
      error={null}
    >
      <DealsIterator />
    </ListBase>
  );
};
