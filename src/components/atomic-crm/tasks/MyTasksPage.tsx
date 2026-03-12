import { useGetIdentity, useGetList, useTranslate } from "ra-core";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { Task as TaskData } from "../types";
import { AddTask } from "./AddTask";
import { TasksKanban } from "./TasksKanban";
import { TasksListByDueDate } from "./TasksListByDueDate";
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { isOverdue } from "./tasksPredicate";
import { getTaskWorkflowStatus } from "./taskWorkflowStatus";

const TASKS_VIEW_STORAGE_KEY = "crm.tasks.display-mode";
const TASK_PREVIEW_MAX_CHARS = 220;

export const MyTasksPage = () => {
  const translate = useTranslate();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center">
        <h1 className="text-xl font-semibold flex-1">
          {translate("crm.tasks.my_tasks", { _: "Tasks" })}
        </h1>
        <AddTask display="icon" selectContact />
      </div>
      <MyTasksContent />
    </div>
  );
};

MyTasksPage.path = "/tasks";

export const MobileMyTasksPage = () => {
  const translate = useTranslate();

  return (
    <>
      <MobileHeader>
        <h1 className="text-xl font-semibold">
          {translate("crm.tasks.my_tasks", { _: "Tasks" })}
        </h1>
        <AddTask display="icon" selectContact />
      </MobileHeader>
      <MobileContent>
        <MyTasksContent />
      </MobileContent>
    </>
  );
};

const MyTasksContent = () => {
  const translate = useTranslate();
  const { identity } = useGetIdentity();
  const [displayMode, setDisplayMode] = useState<"list" | "kanban">(() => {
    if (typeof window === "undefined") {
      return "list";
    }
    const storedMode = window.localStorage.getItem(TASKS_VIEW_STORAGE_KEY);
    return storedMode === "kanban" ? "kanban" : "list";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(TASKS_VIEW_STORAGE_KEY, displayMode);
  }, [displayMode]);

  const { data: myTasks } = useGetList<TaskData>(
    "tasks",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "due_date", order: "ASC" },
      filter: { sales_id: identity?.id },
    },
    { enabled: !!identity?.id },
  );

  const kpi = useMemo(() => {
    const tasks = myTasks || [];
    const todoCount = tasks.filter(
      (task) => getTaskWorkflowStatus(task) === "todo",
    ).length;
    const inProgressCount = tasks.filter(
      (task) => getTaskWorkflowStatus(task) === "in_progress",
    ).length;
    const overdueCount = tasks.filter((task) => {
      return getTaskWorkflowStatus(task) !== "done" && isOverdue(task.due_date);
    }).length;

    return {
      todoCount,
      inProgressCount,
      overdueCount,
    };
  }, [myTasks]);

  return (
    <Tabs defaultValue="active" className="w-full gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="font-normal">
          {translate("crm.tasks.status.todo", { _: "To do" })}: {kpi.todoCount}
        </Badge>
        <Badge variant="outline" className="font-normal">
          {translate("crm.tasks.status.in_progress", { _: "In progress" })}:{" "}
          {kpi.inProgressCount}
        </Badge>
        <Badge variant="outline" className="font-normal">
          {translate("crm.tasks.filter.overdue", { _: "Overdue" })}:{" "}
          {kpi.overdueCount}
        </Badge>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <TabsList className="h-8 rounded-full bg-muted/70 p-0.5">
          <TabsTrigger
            value="active"
            className="h-7 flex-none rounded-full px-3 text-xs font-semibold md:px-3.5 md:text-sm"
          >
            {translate("crm.tasks.active", { _: "To do" })}
          </TabsTrigger>
          <TabsTrigger
            value="archived"
            className="h-7 flex-none rounded-full px-3 text-xs font-semibold md:px-3.5 md:text-sm"
          >
            {translate("crm.tasks.archived", { _: "Archived" })}
          </TabsTrigger>
          <TabsTrigger
            value="assigned"
            className="h-7 flex-none rounded-full px-3 text-xs font-semibold md:px-3.5 md:text-sm"
          >
            {translate("crm.tasks.assigned_by_me", { _: "Assigned by me" })}
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center rounded-full bg-muted/70 p-0.5">
          <Button
            type="button"
            variant={displayMode === "list" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 rounded-full px-3 text-xs font-semibold"
            onClick={() => setDisplayMode("list")}
          >
            {translate("crm.tasks.view.list", { _: "List" })}
          </Button>
          <Button
            type="button"
            variant={displayMode === "kanban" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 rounded-full px-3 text-xs font-semibold"
            onClick={() => setDisplayMode("kanban")}
          >
            {translate("crm.tasks.view.kanban", { _: "Kanban" })}
          </Button>
        </div>
      </div>
      <TabsContent value="active" className="mt-1">
        {displayMode === "list" ? (
          <TasksListByDueDate
            view="all"
            includeDoneTasks
            groupByDueDateInAllView
            showStatus
            maxTextLength={TASK_PREVIEW_MAX_CHARS}
            emptyPlaceholder={
              <p className="text-sm">
                {translate("crm.tasks.empty", {
                  _: "Tasks added to your contacts will appear here.",
                })}
              </p>
            }
          />
        ) : (
          <TasksKanban
            view="all"
            groupBy="status"
            maxTextLength={TASK_PREVIEW_MAX_CHARS}
            emptyPlaceholder={
              <p className="text-sm">
                {translate("crm.tasks.empty", {
                  _: "Tasks added to your contacts will appear here.",
                })}
              </p>
            }
          />
        )}
      </TabsContent>
      <TabsContent value="archived" className="mt-1">
        {displayMode === "list" ? (
          <TasksListByDueDate
            view="archived"
            maxTextLength={TASK_PREVIEW_MAX_CHARS}
            emptyPlaceholder={
              <p className="text-sm text-muted-foreground">
                {translate("crm.tasks.empty_archived", {
                  _: "No archived tasks yet.",
                })}
              </p>
            }
          />
        ) : (
          <TasksKanban
            view="archived"
            maxTextLength={TASK_PREVIEW_MAX_CHARS}
            emptyPlaceholder={
              <p className="text-sm text-muted-foreground">
                {translate("crm.tasks.empty_archived", {
                  _: "No archived tasks yet.",
                })}
              </p>
            }
          />
        )}
      </TabsContent>
      <TabsContent value="assigned" className="mt-1">
        {displayMode === "list" ? (
          <TasksListByDueDate
            view="all"
            scope="assigner"
            filterByAssigner={identity?.id}
            showStatus
            maxTextLength={TASK_PREVIEW_MAX_CHARS}
            emptyPlaceholder={
              <p className="text-sm text-muted-foreground">
                {translate("crm.tasks.empty_assigned", {
                  _: "No tasks assigned by you yet.",
                })}
              </p>
            }
          />
        ) : (
          <TasksKanban
            view="all"
            scope="assigner"
            filterByAssigner={identity?.id}
            showStatus
            maxTextLength={TASK_PREVIEW_MAX_CHARS}
            emptyPlaceholder={
              <p className="text-sm text-muted-foreground">
                {translate("crm.tasks.empty_assigned", {
                  _: "No tasks assigned by you yet.",
                })}
              </p>
            }
          />
        )}
      </TabsContent>
    </Tabs>
  );
};
