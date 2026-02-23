import { DeleteButton, ReferenceField } from "@/components/admin";
import { type Identifier, RecordRepresentation } from "ra-core";
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
  return (
    <EditSheet
      resource="tasks"
      id={taskId}
      title={
        <ReferenceField
          source="contact_id"
          reference="contacts"
          render={({ referenceRecord }) => (
            <h1 className="text-xl font-semibold truncate pr-10">
              Edit Task
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
