import type { Identifier } from "ra-core";
import { useTranslate, useDeleteController, useRecordContext } from "ra-core";
import { EllipsisVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
      headerActions={<ContactEditMenuButton onOpenChange={onOpenChange} />}
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
  const translate = useTranslate();
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVertical />
          <span className="sr-only">
            {translate("ra.action.open_menu", { _: "More" })}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          variant="destructive"
          className="h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
          onSelect={onDelete}
        >
          <Trash2 />
          {translate("ra.action.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
