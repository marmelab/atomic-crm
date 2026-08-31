import type { Identifier } from "ra-core";

import { ContactNewOpportunityButton } from "../contacts/ContactNewOpportunityButton";
import { ACTIVE_WAITLIST_STATUSES } from "./waitlistConstants";
import { useContactWaitlists } from "./useContactWaitlists";

// Decides between the Contact page's two sales entry points (Human-
// acceptance repair pass, §3): a Contact with at least one active
// (waiting/invited) Waitlist Entry gets its "Convert to Opportunity"
// button inline on that entry's own row (ContactWaitlists.tsx renders it
// directly — the click IS the disambiguation when there's more than one);
// a Contact with none gets the single "+ New Opportunity" fallback here.
// Always mounted (unlike ContactWaitlists.tsx, which hides itself when
// there are zero entries at all) so the fallback has a home even for a
// Contact who has never touched a waitlist.
export const ContactSalesAction = ({
  contactId,
}: {
  contactId: Identifier;
}) => {
  const { isPending, entries } = useContactWaitlists(contactId);

  if (isPending) return null;
  const hasActiveEntry = entries.some((entry) =>
    ACTIVE_WAITLIST_STATUSES.has(entry.status),
  );
  if (hasActiveEntry) return null;

  return (
    <div className="mb-6">
      <ContactNewOpportunityButton contactId={contactId} />
    </div>
  );
};
