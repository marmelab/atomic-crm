import type { Identifier } from "ra-core";

import { isDone, isRecentlyDone } from "./tasksPredicate";

type TaskWithDates = {
  due_date: string;
  done_date: string | null;
};

export type TasksListView = "active" | "archived" | "all";
export type TasksListScope = "assignee" | "assigner";

export const getTasksFilter = ({
  filterByContact,
  identityId,
  scope = "assignee",
}: {
  filterByContact?: Identifier;
  identityId?: Identifier;
  scope?: TasksListScope;
}) => {
  if (filterByContact != null) {
    return { contact_id: filterByContact };
  }

  if (scope === "assigner") {
    return { assigned_by_id: identityId };
  }

  return { sales_id: identityId };
};

export const filterTasksByView = (
  tasks: TaskWithDates[],
  {
    view,
    keepRecentlyDone,
  }: {
    view: TasksListView;
    keepRecentlyDone: boolean;
  },
) => {
  if (view === "all") {
    return tasks;
  }

  if (view === "archived") {
    return tasks.filter((task) => isDone(task));
  }

  return tasks.filter(
    (task) => !isDone(task) || (keepRecentlyDone && isRecentlyDone(task)),
  );
};
