import { Plus } from "lucide-react";
import {
  CreateBase,
  Form,
  RecordRepresentation,
  useGetIdentity,
  useNotify,
  useRecordContext,
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

import { TaskFormContent } from "./TaskFormContent";

export const AddTask = ({
  selectClient,
  context = "client",
  display = "chip",
}: {
  selectClient?: boolean;
  context?: "client" | "supplier";
  display?: "chip" | "icon";
}) => {
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const parentRecord = useRecordContext();
  const [open, setOpen] = useState(false);
  const handleOpen = () => {
    setOpen(true);
  };

  const handleSuccess = async () => {
    setOpen(false);
    notify("Promemoria aggiunto");
  };

  if (!identity) return null;

  const defaultRecord =
    context === "supplier"
      ? {
          type: "none",
          all_day: true,
          supplier_id: parentRecord?.id ?? null,
          due_date: new Date().toISOString().slice(0, 10),
        }
      : {
          type: "none",
          all_day: true,
          client_id: parentRecord?.id ?? null,
          due_date: new Date().toISOString().slice(0, 10),
        };

  const representationResource =
    context === "supplier" ? "suppliers" : "clients";

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
            <TooltipContent>Crea promemoria</TooltipContent>
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
            Aggiungi promemoria
          </Button>
        </div>
      )}

      <CreateBase
        resource="client_tasks"
        record={defaultRecord}
        transform={(data) => {
          if (data.all_day) {
            const dueDate = new Date(data.due_date);
            dueDate.setHours(0, 0, 0, 0);
            return { ...data, due_date: dueDate.toISOString() };
          }
          return data;
        }}
        mutationOptions={{ onSuccess: handleSuccess }}
      >
        <Dialog open={open} onOpenChange={() => setOpen(false)}>
          <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
            <Form className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>
                  {!selectClient
                    ? "Crea promemoria per "
                    : "Crea promemoria"}
                  {!selectClient && (
                    <RecordRepresentation
                      record={parentRecord}
                      resource={representationResource}
                    />
                  )}
                </DialogTitle>
              </DialogHeader>
              <TaskFormContent selectClient={selectClient} />
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
