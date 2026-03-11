import type { Identifier } from "ra-core";

import { isDone, isRecentlyDone } from "./tasksPredicate";

type TaskWithDates = {
  due_date: string;
  done_date: string | null;
};

export type TasksListView = "active" | "archived";

export const getTasksFilter = ({
  filterByContact,
  identityId,
}: {
  filterByContact?: Identifier;
  identityId?: Identifier;
}) => {
  if (filterByContact != null) {
    return { contact_id: filterByContact };
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
  if (view === "archived") {
    return tasks.filter((task) => isDone(task));
  }

  return tasks.filter(
    (task) => !isDone(task) || (keepRecentlyDone && isRecentlyDone(task)),
  );
};
