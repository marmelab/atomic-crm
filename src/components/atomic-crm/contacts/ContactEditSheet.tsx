import { RecordRepresentation, useTranslate, type Identifier } from "ra-core";
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
  const translate = useTranslate();
  return (
    <EditSheet
      resource="contacts"
      id={contactId}
      title={
        <h1 className="text-xl font-semibold truncate pr-10">
          {translate("crm.contacts.action.edit", { _: "Edit contact" })}{" "}
          <RecordRepresentation />
        </h1>
      }
      open={open}
      onOpenChange={onOpenChange}
    >
      <ContactInputs />
    </EditSheet>
  );
};
