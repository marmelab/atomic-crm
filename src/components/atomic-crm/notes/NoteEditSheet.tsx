import { DeleteButton, ReferenceField } from "@/components/admin";
import {
  type Identifier,
  useCreatePath,
  useGetRecordRepresentation,
  useTranslate,
  WithRecord,
} from "ra-core";
import { EditSheet } from "../misc/EditSheet";
import { foreignKeyMapping } from "./foreignKeyMapping";
import { NoteInputs } from "./NoteInputs";

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
      deleteButton={
        <WithRecord
          render={(record) => (
            <DeleteButton
              variant="destructive"
              className="flex-1"
              redirect={getRedirectTo(record)}
              onClick={() => {
                onOpenChange(false);
              }}
            />
          )}
        />
      }
    >
      <NoteInputs showStatus />
    </EditSheet>
  );
};
