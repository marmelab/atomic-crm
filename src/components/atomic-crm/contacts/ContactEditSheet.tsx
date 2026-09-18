import type { Identifier } from "ra-core";

import { EditSheet } from "../misc/EditSheet";
import { ContactInputs } from "./ContactInputs";
import {
  cleanupContactForEdit,
  defaultEmailJsonb,
  defaultPhoneJsonb,
} from "./contactModel";

export interface ContactEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: Identifier;
}

// The header used to carry an overflow menu whose only item was Delete —
// an undoable delete, which after the undo window cascades into
// opportunities, sales calls, client sessions, notes, Stripe identities,
// tasks and waitlist entries. The menu held nothing else, so it goes with
// it. See contactSafety.ts.
export const ContactEditSheet = ({
  open,
  onOpenChange,
  contactId,
}: ContactEditSheetProps) => {
  return (
    <EditSheet
      resource="contacts"
      id={contactId}
      open={open}
      onOpenChange={onOpenChange}
      transform={cleanupContactForEdit}
      defaultValues={{
        email_jsonb: defaultEmailJsonb,
        phone_jsonb: defaultPhoneJsonb,
      }}
    >
      <ContactInputs />
    </EditSheet>
  );
};
