import { useGetOne } from "ra-core";

import type { Contact, Deal } from "../types";

// "nurse · Florida · 50s · anxious"
//
// Leif runs this business out of memory as much as out of the CRM, and
// what brings a person back to mind is rarely their pipeline stage. This
// renders that cue next to the person's name in the Opportunity drawer,
// where he is deciding what to do about them.
//
// Hidden entirely when empty — an always-present "Identifiers: —" would
// cost a line of the drawer to say nothing, and this field is expected to
// be blank for most historical Contacts (nothing in the import source
// reliably meant this, so none were guessed).
export const OpportunityContactIdentifiers = ({
  contactId,
}: {
  contactId: Deal["contact_id"];
}) => {
  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: contactId },
    { enabled: contactId != null },
  );

  const identifiers = contact?.identifiers?.trim();
  if (!identifiers) return null;

  return (
    <p className="text-sm text-muted-foreground mt-1" data-testid="identifiers">
      {identifiers}
    </p>
  );
};
