import {
  EditBase,
  Form,
  useNotify,
  useTranslate,
  type Identifier,
} from "ra-core";
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
  const translate = useTranslate();
  return (
    <Dialog open={open} onOpenChange={close}>
      {taskId && (
        <EditBase
          id={taskId}
          resource="tasks"
          className="mt-0"
          mutationOptions={{
            onSuccess: () => {
              close();
              notify("crm.tasks.updated", {
                type: "info",
                undoable: true,
                messageArgs: {
                  _: "Task updated",
                },
              });
            },
          }}
          redirect={false}
        >
          <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
            <Form className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>
                  {translate("crm.tasks.action.edit", { _: "Edit task" })}
                </DialogTitle>
              </DialogHeader>
              <TaskFormContent />
              <DialogFooter className="w-full sm:justify-between gap-4">
                <DeleteButton
                  mutationOptions={{
                    onSuccess: () => {
                      close();
                      notify("crm.tasks.deleted", {
                        type: "info",
                        undoable: true,
                        messageArgs: {
                          _: "Task deleted",
                        },
                      });
                    },
                  }}
                  redirect={false}
                />
                <SaveButton label="ra.action.save" />
              </DialogFooter>
            </Form>
          </DialogContent>
        </EditBase>
      )}
    </Dialog>
  );
};
