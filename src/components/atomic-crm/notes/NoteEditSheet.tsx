import { ReferenceField } from "@/components/admin";
import {
  type Identifier,
  useCreatePath,
  useDeleteController,
  useGetRecordRepresentation,
  useRecordContext,
  useTranslate,
} from "ra-core";
import { EditSheet } from "../misc/EditSheet";
import { foreignKeyMapping } from "./foreignKeyMapping";
import { NoteInputsMobile } from "./NoteInputsMobile";
import { NoteMenuButton } from "./NoteMenuButton";

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
  const getContactRepresentation = useGetRecordRepresentation("contacts");
  const getRedirectTo = (record: any) => {
    return createPath({
      resource: "contacts",
      type: "show",
      id: record ? record[foreignKeyMapping["contacts"]] : undefined,
    });
  };

  return (
    <EditSheet
      resource="contact_notes"
      id={noteId}
      title={
        <ReferenceField
          source={foreignKeyMapping["contacts"]}
          reference="contacts"
          render={({ referenceRecord }) => (
            <span className="text-xl font-semibold truncate pr-10">
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
      deleteButton={false}
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

  return <NoteMenuButton onDelete={onDelete} />;
};
