import { ListContextProvider, ResourceContextProvider, useList } from "ra-core";

import { TasksIterator } from "../tasks/TasksIterator";

type TaskListProps = {
  tasks: any[];
  title: string;
  showContact?: boolean;
  isMobile: boolean;
};

export const TaskListFilter = ({
  tasks,
  title,
  showContact,
  isMobile,
}: TaskListProps) => {
  const listContext = useList({
    data: tasks,
    resource: "tasks",
    perPage: isMobile ? 10 : 5,
  });

  const { total } = listContext;

  if (!tasks?.length || !total) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
        {title}
      </p>
      <ResourceContextProvider value="tasks">
        <ListContextProvider value={listContext}>
          <TasksIterator showContact={showContact == null} />
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
