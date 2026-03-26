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
