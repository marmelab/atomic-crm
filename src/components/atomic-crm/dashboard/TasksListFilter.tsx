import {
  type Identifier,
  ListContextProvider,
  ResourceContextProvider,
  useGetIdentity,
  useGetList,
  useList,
} from "ra-core";

import { TasksIterator } from "../tasks/TasksIterator";
import { useIsMobile } from "@/hooks/use-mobile";
import { startOfToday } from "date-fns/startOfToday";
import { endOfToday } from "date-fns/endOfToday";
import { endOfTomorrow } from "date-fns/endOfTomorrow";
import { endOfWeek } from "date-fns/endOfWeek";
import { isBeforeFriday } from "../tasks/taskFilters";

const today = new Date();
const startOfTodayDate = startOfToday();
const endOfTodayDate = endOfToday();
const endOfTomorrowDate = endOfTomorrow();
const endOfWeekDate = endOfWeek(today, { weekStartsOn: 0 });

type TaskListProps = {
  isPending: boolean;
  tasks: any[];
  total: number;
  title: string;
  filterByContact?: Identifier;
  isMobile: boolean;
};

const TaskList = ({
  isPending,
  tasks,
  total,
  title,
  filterByContact,
  isMobile,
}: TaskListProps) => {
  const listContext = useList({
    data: tasks,
    isPending,
    resource: "tasks",
    perPage: isMobile ? 10 : 5,
  });

  if (isPending || !tasks || !total) return null;

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

export const TasksListFilter = ({
  filterByContact,
}: {
  filterByContact?: Identifier;
}) => {
  const { identity } = useGetIdentity();
  const isMobile = useIsMobile();

  const {
    data: tasks,
    total,
    isPending,
  } = useGetList(
    "tasks",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "due_date", order: "ASC" },
      filter: {
        ...(filterByContact != null
          ? { contact_id: filterByContact }
          : { sales_id: identity?.id }),
      },
    },
    { enabled: filterByContact != null ? true : !!identity },
  );

  const overdueTasks = tasks?.filter(
    (task) =>
      task.done_date == null || new Date(task.due_date) < startOfTodayDate,
  );

  const todayTasks = tasks?.filter((task) => {
    if (task.done_date != null) {
      return false;
    }
    const dueDate = new Date(task.due_date);
    return dueDate >= startOfTodayDate && dueDate < endOfTodayDate;
  });

  const tomorrowTasks = tasks?.filter((task) => {
    if (task.done_date != null) {
      return false;
    }
    const dueDate = new Date(task.due_date);
    return dueDate >= endOfTodayDate && dueDate < endOfTomorrowDate;
  });

  const thisWeekTasks = tasks?.filter((task) => {
    if (task.done_date != null) {
      return false;
    }
    const dueDate = new Date(task.due_date);
    return dueDate >= endOfTomorrowDate && dueDate < endOfWeekDate;
  });

  const laterTasks = tasks?.filter((task) => {
    if (task.done_date != null) {
      return false;
    }
    const dueDate = new Date(task.due_date);
    return dueDate >= endOfWeekDate;
  });

  if (!tasks || !total || isPending) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <TaskList
        isPending={isPending}
        tasks={overdueTasks!}
        total={overdueTasks!.length}
        title="Overdue"
        filterByContact={filterByContact}
        isMobile={isMobile}
      />
      <TaskList
        isPending={isPending}
        tasks={todayTasks!}
        total={todayTasks!.length}
        title="Today"
        filterByContact={filterByContact}
        isMobile={isMobile}
      />
      <TaskList
        isPending={isPending}
        tasks={tomorrowTasks!}
        total={tomorrowTasks!.length}
        title="Tomorrow"
        filterByContact={filterByContact}
        isMobile={isMobile}
      />
      {!filterByContact && isBeforeFriday && (
        <TaskList
          isPending={isPending}
          tasks={thisWeekTasks!}
          total={thisWeekTasks!.length}
          title="This week"
          filterByContact={filterByContact}
          isMobile={isMobile}
        />
      )}
      <TaskList
        isPending={isPending}
        tasks={laterTasks!}
        total={laterTasks!.length}
        title="Later"
        filterByContact={filterByContact}
        isMobile={isMobile}
      />
    </div>
  );
};
