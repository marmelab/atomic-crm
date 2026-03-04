import { DeleteButton } from "@/components/admin/delete-button";
import { ReferenceField } from "@/components/admin/reference-field";
import { type Identifier, RecordRepresentation } from "ra-core";
import { EditSheet } from "../misc/EditSheet";
import type { Client, ClientTask } from "../types";
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
      resource="client_tasks"
      id={taskId}
      title={
        <ReferenceField<ClientTask, Client>
          source="client_id"
          reference="clients"
          render={({ referenceRecord }) => (
            <h1 className="text-xl font-semibold truncate pr-10">
              Modifica promemoria
              {referenceRecord ? (
                <>
                  {" per "}
                  <RecordRepresentation
                    record={referenceRecord}
                    resource="clients"
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
