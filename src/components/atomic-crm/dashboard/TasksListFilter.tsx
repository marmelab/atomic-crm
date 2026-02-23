import {
  type Identifier,
  ListContextProvider,
  ResourceContextProvider,
  useList,
} from "ra-core";

import { TasksIterator } from "../tasks/TasksIterator";
import { useMemo } from "react";

type TaskListProps = {
  isPending: boolean;
  tasks: any[];
  title: string;
  filterByContact?: Identifier;
  isMobile: boolean;
  taskPredicate: (task: any) => boolean;
};

export const TaskListFilter = ({
  isPending,
  tasks,
  taskPredicate,
  title,
  filterByContact,
  isMobile,
}: TaskListProps) => {
  const filteredTasks = useMemo(() => {
    return tasks.filter(taskPredicate);
  }, [tasks, taskPredicate]);
  const listContext = useList({
    data: filteredTasks,
    isPending,
    resource: "tasks",
    perPage: isMobile ? 10 : 5,
  });

  const { total } = listContext;

  if (!filteredTasks?.length || !total) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
        {title}
      </p>
      <ResourceContextProvider value="tasks">
        <ListContextProvider value={listContext}>
          <TasksIterator showContact={filterByContact == null} />
        </ListContextProvider>
      </ResourceContextProvider>
      {total > listContext.perPage && (
        <div className="flex justify-center">
          <a
            href="#"
            onClick={(e) => {
              listContext.setPerPage(listContext.perPage + 10);
              e.preventDefault();
            }}
            className="text-sm underline hover:no-underline"
          >
            Load more
          </a>
        </div>
      )}
    </div>
  );
};
