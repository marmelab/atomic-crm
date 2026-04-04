import { EllipsisVertical, Trash2 } from "lucide-react";
import {
  type Identifier,
  useCreatePath,
  useDeleteController,
  useGetRecordRepresentation,
  useRecordContext,
  useTranslate,
} from "ra-core";
import { ReferenceField } from "@/components/admin";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { EditSheet } from "../misc/EditSheet";
import { foreignKeyMapping } from "./foreignKeyMapping";
import { NoteInputsMobile } from "./NoteInputsMobile";

export interface NoteEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: Identifier;
}

export const NoteEditSheet = ({
  open,
  onOpenChange,
  noteId,
}: NoteEditSheetProps) => {
  const createPath = useCreatePath();
  const translate = useTranslate();
  const getRedirectTo = (record: any) => {
    return createPath({
      resource: "contacts",
      type: "show",
      id: record ? record[foreignKeyMapping["contacts"]] : undefined,
    });
  };
  const getContactRepresentation = useGetRecordRepresentation("contacts");

  return (
    <EditSheet
      resource="contact_notes"
      id={noteId}
      title={
        <ReferenceField
          source={foreignKeyMapping["contacts"]}
          reference="contacts"
          render={({ referenceRecord }) => (
            <span className="text-xl font-semibold truncate">
              {referenceRecord
                ? translate("resources.notes.sheet.edit_for", {
                    name: getContactRepresentation(referenceRecord),
                  })
                : translate("resources.notes.sheet.edit")}
            </span>
          )}
        />
      }
      redirect={(_resource, _id, record) => getRedirectTo(record)}
      open={open}
      onOpenChange={onOpenChange}
      headerActions={
        <NoteEditMenuButton
          onOpenChange={onOpenChange}
          getRedirectTo={getRedirectTo}
        />
      }
    >
      <NoteInputsMobile />
    </EditSheet>
  );
};

const NoteEditMenuButton = ({
  onOpenChange,
  getRedirectTo,
}: {
  onOpenChange: (open: boolean) => void;
  getRedirectTo: (record: any) => string;
}) => {
  const translate = useTranslate();
  const record = useRecordContext();
  const { handleDelete } = useDeleteController({
    record,
    resource: "contact_notes",
    redirect: getRedirectTo(record),
    mutationMode: "undoable",
  });

  const onDelete = () => {
    onOpenChange(false);
    handleDelete();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="opacity-70 transition-opacity hover:opacity-100 rounded-xs"
        >
          <EllipsisVertical className="size-6" />
          <span className="sr-only">
            {translate("ra.action.open_menu", { _: "More" })}
          </span>
        </button>
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
