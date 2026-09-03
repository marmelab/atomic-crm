import { Plus } from "lucide-react";
import {
  CreateBase,
  Form,
  useDataProvider,
  useGetIdentity,
  useGetRecordRepresentation,
  useNotify,
  useRecordContext,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useState } from "react";
import { SaveButton } from "@/components/admin/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { Task } from "../types";
import { TaskFormContent } from "./TaskFormContent";

export const AddTask = ({
  selectContact,
  display = "chip",
}: {
  selectContact?: boolean;
  display?: "chip" | "icon";
}) => {
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider();
  const [update] = useUpdate();
  const notify = useNotify();
  const translate = useTranslate();
  const contact = useRecordContext();
  const [open, setOpen] = useState(false);
  const [failedTask, setFailedTask] = useState<Partial<Task>>();
  const handleOpen = () => {
    setOpen(true);
  };
  const getContactRepresentation = useGetRecordRepresentation("contacts");

  const handleSuccess = async (data: Task) => {
    setFailedTask(undefined);
    setOpen(false);
    notify("resources.tasks.added");

    try {
      const { data: contact } = await dataProvider.getOne("contacts", {
        id: data.contact_id,
      });
      await update("contacts", {
        id: contact.id,
        data: { last_seen: new Date().toISOString() },
        previousData: contact,
      });
    } catch (error) {
      console.error("Could not update the contact last_seen date", error);
    }
  };

  const handleSettled = (
    _data: unknown,
    error: unknown,
    variables: { data?: Partial<Task> },
  ) => {
    if (!error) return;
    setFailedTask(variables.data);
    setOpen(true);
  };

  if (!identity) return null;

  return (
    <>
      {display === "icon" ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="p-2 cursor-pointer"
                onClick={handleOpen}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {translate("resources.tasks.action.create")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <div className="my-2">
          <Button
            variant="outline"
            className="h-6 cursor-pointer"
            onClick={handleOpen}
            size="sm"
          >
            <Plus className="w-4 h-4" />
            {translate("resources.tasks.action.add")}
          </Button>
        </div>
      )}

      <CreateBase
        resource="tasks"
        record={
          failedTask ?? {
            type: "none",
            contact_id: contact?.id,
            due_date: new Date().toISOString(),
            sales_id: identity.id,
          }
        }
        mutationOptions={{ onSuccess: handleSuccess, onSettled: handleSettled }}
      >
        <Dialog
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (!nextOpen) {
              // Dismissing the dialog discards the failed task on purpose.
              setFailedTask(undefined);
            }
          }}
        >
          <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
            <Form className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>
                  {!selectContact
                    ? translate("resources.tasks.dialog.create_for", {
                        name: getContactRepresentation(contact!),
                      })
                    : translate("resources.tasks.dialog.create")}
                </DialogTitle>
              </DialogHeader>
              <TaskFormContent selectContact={selectContact} />
              <DialogFooter className="w-full justify-end">
                <SaveButton />
              </DialogFooter>
            </Form>
          </DialogContent>
        </Dialog>
      </CreateBase>
    </>
  );
};
