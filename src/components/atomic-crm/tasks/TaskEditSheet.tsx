import { DeleteButton, ReferenceField } from "@/components/admin";
import type { Identifier } from "ra-core";
import { useGetRecordRepresentation, useTranslate } from "ra-core";
import { EditSheet } from "../misc/EditSheet";
import { TaskFormContent } from "./TaskFormContent";

export interface TaskEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: Identifier;
}

export const TaskEditSheet = ({
  open,
  onOpenChange,
  taskId,
}: TaskEditSheetProps) => {
  const translate = useTranslate();
  const getContactRepresentation = useGetRecordRepresentation("contacts");
  return (
    <EditSheet
      resource="tasks"
      id={taskId}
      title={
        <ReferenceField
          source="contact_id"
          reference="contacts"
          render={({ referenceRecord }) => (
            <span className="text-xl font-semibold truncate pr-10">
              {referenceRecord
                ? translate("resources.tasks.sheet.edit_for", {
                    name: getContactRepresentation(referenceRecord),
                  })
                : translate("resources.tasks.sheet.edit")}
            </span>
          )}
        />
      }
      redirect={false}
      open={open}
      onOpenChange={onOpenChange}
      deleteButton={
        <DeleteButton
          variant="destructive"
          className="flex-1"
          redirect={false}
          onClick={() => {
            onOpenChange(false);
          }}
        />
      }
    >
      <TaskFormContent />
    </EditSheet>
  );
};
