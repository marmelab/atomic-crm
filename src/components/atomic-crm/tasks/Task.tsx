import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical } from "lucide-react";
import {
  useDeleteWithUndoController,
  useGetRecordRepresentation,
  useNotify,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useEffect, useState } from "react";
import { ReferenceField } from "@/components/admin/reference-field";
import { DateField } from "@/components/admin/date-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact, Task as TData, TaskStatus } from "../types";
import { TaskEdit } from "./TaskEdit";
import { TaskEditSheet } from "./TaskEditSheet";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  TASK_STATUSES,
  TASK_STATUS_MAP,
  resolveStatus,
} from "./taskStatus";

export const Task = ({
  task,
  showContact,
  showAssignee,
}: {
  task: TData;
  showContact?: boolean;
  showAssignee?: boolean;
}) => {
  const isMobile = useIsMobile();
  const { taskTypes } = useConfigurationContext();
  const notify = useNotify();
  const translate = useTranslate();
  const queryClient = useQueryClient();
  const getContactRepresentation = useGetRecordRepresentation("contacts");

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
        notify("resources.tasks.deleted", {
          undoable: true,
        });
      },
    },
  });

  const handleEdit = () => {
    setOpenEdit(true);
  };

  const handleCheck = () => () => {
    const nowDone = !task.done_date;
    update("tasks", {
      id: task.id,
      data: {
        done_date: nowDone ? new Date().toISOString() : null,
        status: nowDone ? "completed" : "todo",
      },
      previousData: task,
    });
  };

  const handleStatusChange = (newStatus: TaskStatus) => {
    const isCompleting = newStatus === "completed";
    update("tasks", {
      id: task.id,
      data: {
        status: newStatus,
        done_date: isCompleting
          ? (task.done_date ?? new Date().toISOString())
          : null,
      },
      previousData: task,
    });
  };

  useEffect(() => {
    // We do not want to invalidate the query when a task is checked or unchecked
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
  const currentStatus = resolveStatus(task.status);
  const statusMeta = TASK_STATUS_MAP[currentStatus];

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
            <div className="text-sm flex items-center gap-1.5 flex-wrap">
              {task.priority && task.priority !== "medium" && (
                <span
                  className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                    task.priority === "high" ? "bg-red-500" : "bg-slate-400"
                  }`}
                  title={
                    task.priority === "high" ? "High priority" : "Low priority"
                  }
                />
              )}
              {task.type && task.type !== "none" && (
                <>
                  <span className="font-semibold text-sm">
                    {(() => {
                      const matchedTaskType = taskTypes.find(
                        (taskType) => taskType.value === task.type,
                      );
                      return matchedTaskType
                        ? matchedTaskType.label
                        : task.type;
                    })()}
                  </span>
                  &nbsp;
                </>
              )}
              {task.text}
              {/* Status badge — hidden for default 'todo' to reduce noise */}
              {currentStatus !== "todo" && (
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none shrink-0 ${statusMeta.color}`}
                >
                  {statusMeta.label}
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {translate("resources.tasks.fields.due_short")}
              &nbsp;
              <DateField source="due_date" record={task} showDate showTime />
              {showContact && (
                <ReferenceField<TData, Contact>
                  source="contact_id"
                  reference="contacts"
                  record={task}
                  link="show"
                  className="inline text-sm text-muted-foreground"
                  render={({ referenceRecord }) => {
                    if (!referenceRecord) return null;
                    return (
                      <>
                        {" "}
                        {translate("resources.tasks.regarding_contact", {
                          name: getContactRepresentation(referenceRecord),
                        })}
                      </>
                    );
                  }}
                />
              )}
              {showAssignee && task.sales_id && (
                <ReferenceField<TData, any>
                  source="sales_id"
                  reference="sales"
                  record={task}
                  link={false}
                  className="inline text-sm text-muted-foreground"
                  render={({ referenceRecord }) => {
                    if (!referenceRecord) return null;
                    return (
                      <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded">
                        {referenceRecord.first_name} {referenceRecord.last_name}
                      </span>
                    );
                  }}
                />
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
              aria-label={translate("resources.tasks.actions.title")}
            >
              <MoreVertical className="size-5 md:size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Status sub-menu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="h-12 md:h-8 px-4 md:px-2 text-base md:text-sm cursor-pointer">
                <span>
                  Status:{" "}
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${statusMeta.color}`}
                  >
                    {statusMeta.label}
                  </span>
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {TASK_STATUSES.map((s) => (
                  <DropdownMenuItem
                    key={s.value}
                    className="cursor-pointer h-10 md:h-8 px-4 md:px-3 text-base md:text-sm gap-2"
                    onClick={() => handleStatusChange(s.value)}
                  >
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${s.color}`}
                    >
                      {s.label}
                    </span>
                    {s.value === currentStatus && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        ✓
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
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
              {translate("resources.tasks.actions.postpone_tomorrow")}
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
              {translate("resources.tasks.actions.postpone_next_week")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onClick={handleEdit}
            >
              {translate("ra.action.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onClick={handleDelete}
            >
              {translate("ra.action.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isMobile ? (
        <TaskEditSheet
          taskId={task.id}
          open={openEdit}
          onOpenChange={setOpenEdit}
          previousSalesId={task.sales_id}
        />
      ) : (
        <TaskEdit
          taskId={task.id}
          open={openEdit}
          close={handleCloseEdit}
          previousSalesId={task.sales_id}
        />
      )}
    </>
  );
};
