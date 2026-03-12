import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  Calendar,
  Clock,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  useDeleteWithUndoController,
  useNotify,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useEffect, useState } from "react";
import { ReferenceField } from "@/components/admin/reference-field";
import { DateField } from "@/components/admin/date-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { SaleName } from "../sales/SaleName";
import type { Contact, Sale, Task as TData } from "../types";
import { TaskEdit } from "./TaskEdit";
import { TaskEditSheet } from "./TaskEditSheet";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  isDueLater,
  isDueThisWeek,
  isDueToday,
  isDueTomorrow,
  isOverdue,
} from "./tasksPredicate";
import {
  getTaskCompletionPatch,
  getTaskWorkflowStatus,
  type TaskWorkflowStatus,
} from "./taskWorkflowStatus";

export const Task = ({
  task,
  showContact,
  showAsArchived = false,
  showStatus = false,
  openOnCardClick = false,
  showCheckbox = true,
  strikeDoneText = true,
}: {
  task: TData;
  showContact?: boolean;
  showAsArchived?: boolean;
  showStatus?: boolean;
  openOnCardClick?: boolean;
  showCheckbox?: boolean;
  strikeDoneText?: boolean;
}) => {
  const isMobile = useIsMobile();
  const { taskTypes } = useConfigurationContext();
  const notify = useNotify();
  const translate = useTranslate();
  const queryClient = useQueryClient();
  const dueBadge = getDueBadgeLabel(task.due_date, translate);
  const isArchivedTask = showAsArchived || !!task.done_date;
  const workflowStatus = getTaskWorkflowStatus(task);

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
        notify("crm.tasks.notifications.deleted", {
          undoable: true,
          messageArgs: { _: "Task deleted successfully" },
        });
      },
    },
  });

  const handleEdit = () => {
    setOpenEdit(true);
  };

  const handleCheck = () => () => {
    const isDone = workflowStatus === "done";
    update("tasks", {
      id: task.id,
      data: getTaskCompletionPatch(isDone ? "todo" : "done", task.done_date),
      previousData: task,
    });
  };

  const handleWorkflowStatusChange = (nextStatus: TaskWorkflowStatus) => () => {
    update("tasks", {
      id: task.id,
      data: getTaskCompletionPatch(nextStatus, task.done_date),
      previousData: task,
    });
  };

  const handleArchive = () => {
    update("tasks", {
      id: task.id,
      data: getTaskCompletionPatch("done", task.done_date),
      previousData: task,
    });
    notify("crm.tasks.notifications.archived", {
      messageArgs: { _: "Task archived" },
    });
  };

  const handleRestore = () => {
    update("tasks", {
      id: task.id,
      data: getTaskCompletionPatch("todo", task.done_date),
      previousData: task,
    });
    notify("crm.tasks.notifications.restored", {
      messageArgs: { _: "Task restored" },
    });
  };

  useEffect(() => {
    // We do not want to invalidate the query when a tack is checked or unchecked
    const hasOnlyTaskStateUpdate =
      variables?.data != null &&
      Object.keys(variables.data).every((key) =>
        ["done_date", "workflow_status"].includes(key),
      );

    if (isUpdatePending || !isSuccess || hasOnlyTaskStateUpdate) {
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["tasks", "getList"] });
  }, [queryClient, isUpdatePending, isSuccess, variables]);

  const labelId = `checkbox-list-label-${task.id}`;
  const handleCardClick = () => {
    if (openOnCardClick) {
      handleEdit();
      return;
    }
    if (showCheckbox && isMobile && !showAsArchived) {
      handleCheck()();
    }
  };

  return (
    <>
      <div
        className={`flex items-start justify-between gap-2 rounded-lg border px-3 py-2 transition-colors ${
          isArchivedTask ? "bg-muted/40" : "bg-background hover:bg-muted/20"
        } ${openOnCardClick ? "cursor-pointer" : ""}`}
      >
        <div
          className="flex items-start gap-2 flex-1"
          onClick={handleCardClick}
        >
          {showCheckbox && (
            <Checkbox
              id={labelId}
              checked={!!task.done_date}
              onCheckedChange={handleCheck()}
              disabled={isUpdatePending || showAsArchived}
              className="mt-1"
              onClick={(event) => event.stopPropagation()}
            />
          )}
          <div
            className={`flex-grow ${
              strikeDoneText && workflowStatus === "done" ? "line-through" : ""
            }`}
          >
            <div className="text-sm leading-5 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
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
            <div className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
              {showStatus && (
                <Badge
                  variant="outline"
                  className={
                    workflowStatus === "done"
                      ? "border-emerald-200 text-emerald-700"
                      : workflowStatus === "in_progress"
                        ? "border-sky-200 text-sky-700"
                        : "border-amber-200 text-amber-700"
                  }
                >
                  {workflowStatus === "done"
                    ? translate("crm.tasks.status.done", { _: "Done" })
                    : workflowStatus === "in_progress"
                      ? translate("crm.tasks.status.in_progress", {
                          _: "In progress",
                        })
                      : translate("crm.tasks.status.todo", { _: "To do" })}
                </Badge>
              )}
              {dueBadge && (
                <Badge variant="outline" className={dueBadge.className}>
                  {dueBadge.label}
                </Badge>
              )}
              {task.due_date && (
                <>
                  <span>{translate("crm.tasks.due_prefix", { _: "due" })}</span>
                  <DateField
                    source="due_date"
                    record={task}
                    showDate
                    showTime
                  />
                </>
              )}
              {task.sales_id != null && (
                <ReferenceField<TData, Sale>
                  source="sales_id"
                  reference="sales"
                  record={task}
                  link={false}
                  className="inline text-sm text-muted-foreground break-words [overflow-wrap:anywhere]"
                  render={({ referenceRecord }) => {
                    const sale = referenceRecord as Sale | undefined;
                    if (!sale) return null;
                    return (
                      <>
                        {" • "}
                        {translate("resources.tasks.fields.sales_id", {
                          _: "Assigned to",
                        })}
                        : <SaleName sale={sale} />
                      </>
                    );
                  }}
                />
              )}
              {showContact && (
                <ReferenceField<TData, Contact>
                  source="contact_id"
                  reference="contacts"
                  record={task}
                  link="show"
                  className="inline text-sm text-muted-foreground break-words [overflow-wrap:anywhere]"
                  render={({ referenceRecord }) => {
                    if (!referenceRecord) return null;
                    return (
                      <>
                        {" "}
                        ({translate("crm.tasks.re", { _: "Re:" })}&nbsp;
                        {referenceRecord?.first_name}{" "}
                        {referenceRecord?.last_name})
                      </>
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
              className="h-5 pr-0! size-8 cursor-pointer shrink-0"
              aria-label={translate("crm.tasks.actions", {
                _: "task actions",
              })}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreVertical className="size-5 md:size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!showAsArchived && (
              <>
                <DropdownMenuItem
                  className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
                  onClick={handleWorkflowStatusChange("todo")}
                >
                  {translate("crm.tasks.status.todo", { _: "To do" })}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
                  onClick={handleWorkflowStatusChange("in_progress")}
                >
                  {translate("crm.tasks.status.in_progress", {
                    _: "In progress",
                  })}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
                  onClick={handleWorkflowStatusChange("done")}
                >
                  {translate("crm.tasks.status.done", { _: "Done" })}
                </DropdownMenuItem>
              </>
            )}
            {!isArchivedTask && (
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
                <Clock className="size-4" />
                {translate("crm.tasks.postpone_tomorrow", {
                  _: "Postpone to tomorrow",
                })}
              </DropdownMenuItem>
            )}
            {!isArchivedTask && (
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
                <Calendar className="size-4" />
                {translate("crm.tasks.postpone_next_week", {
                  _: "Postpone to next week",
                })}
              </DropdownMenuItem>
            )}
            {!isArchivedTask && (
              <DropdownMenuItem
                className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
                onClick={handleEdit}
              >
                <Pencil className="size-4" />
                {translate("ra.action.edit", { _: "Edit" })}
              </DropdownMenuItem>
            )}
            {!isArchivedTask && (
              <DropdownMenuItem
                className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
                onClick={handleArchive}
              >
                <Archive className="size-4" />
                {translate("crm.tasks.archive", { _: "Archive" })}
              </DropdownMenuItem>
            )}
            {isArchivedTask && (
              <DropdownMenuItem
                className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
                onClick={handleRestore}
              >
                <ArchiveRestore className="size-4" />
                {translate("crm.tasks.restore", { _: "Restore" })}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm text-destructive focus:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="size-4" />
              {translate("ra.action.delete", { _: "Delete" })}
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

const getDueBadgeLabel = (
  dueDate: string | undefined,
  translate: (key: string, options?: any) => string,
): { label: string; className?: string } | null => {
  if (!dueDate) {
    return null;
  }

  if (isOverdue(dueDate)) {
    return {
      label: translate("crm.tasks.filter.overdue", { _: "Overdue" }),
      className: "border-destructive/50 text-destructive",
    };
  }

  if (isDueToday(dueDate)) {
    return {
      label: translate("crm.filters.today", { _: "Today" }),
      className: "border-amber-500/50 text-amber-700 dark:text-amber-400",
    };
  }

  if (isDueTomorrow(dueDate)) {
    return {
      label: translate("crm.tasks.filter.tomorrow", { _: "Tomorrow" }),
    };
  }

  if (isDueThisWeek(dueDate)) {
    return {
      label: translate("crm.filters.this_week", { _: "This week" }),
    };
  }

  if (isDueLater(dueDate)) {
    return {
      label: translate("crm.tasks.filter.later", { _: "Later" }),
    };
  }

  return null;
};
