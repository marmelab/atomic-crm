import { DeleteButton, ReferenceField } from "@/components/admin";
import {
  type Identifier,
  RecordRepresentation,
  useCreatePath,
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
            <h1 className="text-xl font-semibold truncate pr-10">
              Edit Note
              {referenceRecord ? (
                <>
                  {" for "}
                  <RecordRepresentation
                    record={referenceRecord}
                    resource="contacts"
                  />
                </>
              ) : null}
            </h1>
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
