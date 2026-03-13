import type { Identifier } from "ra-core";
import { EditSheet } from "../misc/EditSheet";
import { ContactInputs } from "./ContactInputs";

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
    >
      <ContactInputs />
    </EditSheet>
  );
};
