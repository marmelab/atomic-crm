import type { Identifier } from "ra-core";
import { useDeleteController, useRecordContext } from "ra-core";
import { EditSheet } from "../misc/EditSheet";
import { ContactInputs } from "./ContactInputs";
import { ContactMenuButton } from "./ContactMenuButton";
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
      headerActions={<ContactEditMenuButton onOpenChange={onOpenChange} />}
      deleteButton={false}
    >
      <ContactInputs />
    </EditSheet>
  );
};

const ContactEditMenuButton = ({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) => {
  const record = useRecordContext();
  const { handleDelete } = useDeleteController({
    record,
    resource: "contacts",
    redirect: "list",
    mutationMode: "undoable",
  });

  const onDelete = () => {
    onOpenChange(false);
    handleDelete();
  };

  return <ContactMenuButton onDelete={onDelete} />;
};
