import { RecordRepresentation, type Identifier } from "ra-core";
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
      title={
        <>
          Edit <RecordRepresentation />
        </>
      }
      open={open}
      onOpenChange={onOpenChange}
      mutationMode="undoable"
    >
      <ContactInputs />
    </EditSheet>
  );
};
