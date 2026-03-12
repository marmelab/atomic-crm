import {
  ListContextProvider,
  ResourceContextProvider,
  useList,
  useTranslate,
} from "ra-core";
import { Button } from "@/components/ui/button";

import { TasksIterator } from "./TasksIterator";

type TaskListProps = {
  tasks: any[];
  title: string;
  showContact?: boolean;
  isMobile: boolean;
  includeDoneTasks?: boolean;
  showAsArchived?: boolean;
  showStatus?: boolean;
};

export const TaskListFilter = ({
  tasks,
  title,
  showContact,
  isMobile,
  includeDoneTasks = false,
  showAsArchived = false,
  showStatus = false,
}: TaskListProps) => {
  const translate = useTranslate();
  const listContext = useList({
    data: tasks,
    resource: "tasks",
    perPage: isMobile ? 10 : 5,
  });

  const { total } = listContext;

  if (!tasks?.length || !total) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {title}
        </p>
        <span className="text-xs text-muted-foreground">{total}</span>
      </div>
      <ResourceContextProvider value="tasks">
        <ListContextProvider value={listContext}>
          <TasksIterator
            showContact={showContact}
            includeDoneTasks={includeDoneTasks}
            showAsArchived={showAsArchived}
            showStatus={showStatus}
          />
        </ListContextProvider>
      </ResourceContextProvider>
      {total > listContext.perPage && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              listContext.setPerPage(listContext.perPage + 10);
            }}
            className="text-sm"
          >
            {translate("crm.load_more", { _: "Load more" })}
          </Button>
        </div>
      )}
    </div>
  );
};
