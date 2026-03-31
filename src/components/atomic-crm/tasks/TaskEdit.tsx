import { EditBase, Form, useNotify, type Identifier } from "ra-core";
import { DeleteButton } from "@/components/admin/delete-button";
import { SaveButton } from "@/components/admin/form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { TaskFormContent } from "./TaskFormContent";
import { normalizeTaskDueDateForMutation } from "./taskDueDate";

export const TaskEdit = ({
  open,
  close,
  taskId,
}: {
  taskId: Identifier;
  open: boolean;
  close: () => void;
}) => {
  const notify = useNotify();
  return (
    <Dialog open={open} onOpenChange={close}>
      {taskId && (
        <EditBase
          id={taskId}
          resource="client_tasks"
          className="mt-0"
          transform={(data) => {
            if (typeof data.due_date === "string") {
              return {
                ...data,
                due_date: normalizeTaskDueDateForMutation(
                  data.due_date,
                  data.all_day === true,
                ),
              };
            }
            return data;
          }}
          mutationOptions={{
            onSuccess: () => {
              close();
              notify("Attività aggiornata", {
                type: "info",
                undoable: true,
              });
            },
          }}
          redirect={false}
        >
          <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
            <Form className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Modifica attività</DialogTitle>
              </DialogHeader>
              <TaskFormContent />
              <DialogFooter className="w-full sm:justify-between gap-4">
                <DeleteButton
                  mutationOptions={{
                    onSuccess: () => {
                      close();
                      notify("Attività eliminata", {
                        type: "info",
                        undoable: true,
                      });
                    },
                  }}
                  redirect={false}
                />
                <SaveButton label="Salva" />
              </DialogFooter>
            </Form>
          </DialogContent>
        </EditBase>
      )}
    </Dialog>
  );
};
