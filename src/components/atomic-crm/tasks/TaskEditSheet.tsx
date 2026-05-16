import { ReferenceField } from "@/components/admin";
import type { Identifier } from "ra-core";
import { useGetRecordRepresentation, useTranslate } from "ra-core";
import { EditSheet } from "../misc/EditSheet";
import { TaskFormContent } from "./TaskFormContent";
import { useTaskAssignmentNotify } from "./useTaskAssignmentNotify";

export interface TaskEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: Identifier;
  previousSalesId?: Identifier | null;
}

export const TaskEditSheet = ({
  open,
  onOpenChange,
  taskId,
  previousSalesId,
}: TaskEditSheetProps) => {
  const translate = useTranslate();
  const getContactRepresentation = useGetRecordRepresentation("contacts");
  const notifyAssignment = useTaskAssignmentNotify();
  return (
    <EditSheet
      resource="tasks"
      id={taskId}
      mutationOptions={{
        onSuccess: (data: any) => {
          onOpenChange(false);
          if (data?.sales_id) {
            notifyAssignment(data.id, data.sales_id, previousSalesId);
          }
        },
      }}
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
    >
      <TaskFormContent />
    </EditSheet>
  );
};
