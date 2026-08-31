// Centralizes the Do Not Engage guard (Native Applications repair pass,
// §4; reused by the Waitlists slice, §5) so it lives in exactly one place
// rather than being reimplemented per "select a Contact" field — the
// Opportunity Person field and the Waitlist Person field both call this.
import type { DataProvider, Identifier } from "ra-core";

import type { Contact } from "../types";

export const isContactDoNotEngage = async (
  dataProvider: DataProvider,
  contactId: Identifier,
): Promise<boolean> => {
  const { data: contact } = await dataProvider.getOne<Contact>("contacts", {
    id: contactId,
  });
  return contact.sales_eligibility === "do_not_engage";
};

// An async validate() function for react-admin's `validate` prop on any
// "select a Contact" input. The Contact stays fully selectable in the
// field itself (hiding them would just invite an accidental duplicate
// Contact) — this only blocks the *submission* that would create a new
// direct-sales relationship for them. `enabled` lets the caller scope
// blocking narrowly (e.g. never when merely editing something that
// already exists for a Contact who became DNE afterward).
export const doNotEngageValidator =
  (dataProvider: DataProvider, message: string, enabled = true) =>
  async (value?: Identifier) => {
    if (!enabled || !value) return undefined;
    const isDne = await isContactDoNotEngage(dataProvider, value);
    return isDne ? message : undefined;
  };
