import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical } from "lucide-react";
import {
  type Identifier,
  useDeleteWithUndoController,
  useGetList,
  useNotify,
  useUpdate,
} from "ra-core";
import { useEffect, useState, type MouseEvent } from "react";
import { Link } from "react-router";
import { ReferenceField } from "@/components/admin/reference-field";
import { DateField } from "@/components/admin/date-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact, Deal, Task as TData } from "../types";
import { TaskEdit } from "./TaskEdit";
import { TaskEditSheet } from "./TaskEditSheet";
import { useIsMobile } from "@/hooks/use-mobile";

export const Task = ({
  task,
  showContact,
}: {
  task: TData;
  showContact?: boolean;
}) => {
  const isMobile = useIsMobile();
  const { taskTypes } = useConfigurationContext();
  const notify = useNotify();
  const queryClient = useQueryClient();

  const [openEdit, setOpenEdit] = useState(false);

  const handleCloseEdit = () => {
    setOpenEdit(false);
  };

  const [update, { isPending: isUpdatePending, isSuccess, variables }] =
    useUpdate();
  const { handleDelete } = useDeleteWithUndoController({
    record: task,
    redirect: false,
    mutationOptions: {
      onSuccess() {
        notify("Tâche supprimée", { undoable: true });
      },
    },
  });

  const handleEdit = () => {
    setOpenEdit(true);
  };

  const handleCheck = () => () => {
    update("tasks", {
      id: task.id,
      data: {
        done_date: task.done_date ? null : new Date().toISOString(),
      },
      previousData: task,
    });
  };

  useEffect(() => {
    // We do not want to invalidate the query when a tack is checked or unchecked
    if (
      isUpdatePending ||
      !isSuccess ||
      variables?.data?.done_date != undefined
    ) {
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["tasks", "getList"] });
  }, [queryClient, isUpdatePending, isSuccess, variables]);

  const labelId = `checkbox-list-label-${task.id}`;

  return (
    <>
      <div className="flex items-start justify-between">
        <div
          className="flex items-start gap-2 flex-1"
          onClick={isMobile ? handleCheck() : undefined}
        >
          <Checkbox
            id={labelId}
            checked={!!task.done_date}
            onCheckedChange={handleCheck()}
            disabled={isUpdatePending}
            className="mt-1"
          />
          <div className={`flex-grow ${task.done_date ? "line-through" : ""}`}>
            <div className="text-sm">
              {task.type && task.type !== "none" && (
                <>
                  <span className="font-semibold text-sm">
                    {taskTypes.find((t) => t.value === task.type)?.label ??
                      task.type}
                  </span>
                  &nbsp;
                </>
              )}
              {task.text}
            </div>
            <div className="text-sm text-muted-foreground">
              due&nbsp;
              <DateField source="due_date" record={task} showDate showTime />
              {showContact && (
                <>
                  {" · "}
                  <ReferenceField<TData, Contact>
                    source="contact_id"
                    reference="contacts"
                    record={task}
                    link="show"
                    className="inline text-sm [&_a]:text-foreground [&_a]:hover:underline"
                    render={({ referenceRecord }) => {
                      if (!referenceRecord) return null;
                      return (
                        <>
                          {referenceRecord?.first_name}{" "}
                          {referenceRecord?.last_name}
                        </>
                      );
                    }}
                  />
                  <TaskDealLink contactId={task.contact_id} />
                </>
              )}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 pr-0! size-8 cursor-pointer"
              aria-label="task actions"
            >
              <MoreVertical className="size-5 md:size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onClick={() => {
                update("tasks", {
                  id: task.id,
                  data: {
                    due_date: new Date(Date.now() + 24 * 60 * 60 * 1000)
                      .toISOString()
                      .slice(0, 10),
                  },
                  previousData: task,
                });
              }}
            >
              Postpone to tomorrow
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onClick={() => {
                update("tasks", {
                  id: task.id,
                  data: {
                    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                      .toISOString()
                      .slice(0, 10),
                  },
                  previousData: task,
                });
              }}
            >
              Postpone to next week
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onClick={handleEdit}
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onClick={handleDelete}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isMobile ? (
        <TaskEditSheet
          taskId={task.id}
          open={openEdit}
          onOpenChange={setOpenEdit}
        />
      ) : (
        <TaskEdit taskId={task.id} open={openEdit} close={handleCloseEdit} />
      )}
    </>
  );
};

const stopPropagation = (e: MouseEvent) => e.stopPropagation();

const TaskDealLink = ({ contactId }: { contactId: Identifier }) => {
  const { data: deals, isPending } = useGetList<Deal>(
    "deals",
    {
      pagination: { page: 1, perPage: 3 },
      sort: { field: "updated_at", order: "DESC" },
      filter: {
        "contact_ids@cs": `{${contactId}}`,
        "archived_at@is": null,
      },
    },
    { enabled: contactId != null },
  );

  if (isPending || !deals || deals.length === 0) return null;

  if (deals.length === 1) {
    const deal = deals[0];
    return (
      <>
        {" · "}
        <Link
          to={`/deals/${deal.id}/show`}
          onClick={stopPropagation}
          className="text-foreground hover:underline"
        >
          {deal.name}
        </Link>
      </>
    );
  }

  return (
    <>
      {" · "}
      <Link
        to={`/contacts/${contactId}/show`}
        onClick={stopPropagation}
        className="text-foreground hover:underline"
      >
        {deals.length} opportunités
      </Link>
    </>
  );
};
