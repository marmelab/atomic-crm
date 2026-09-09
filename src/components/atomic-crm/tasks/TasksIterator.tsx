import { useListContext } from "ra-core";

import { Task } from "./Task";
import type { Task as TaskType } from "../types";

export const TasksIterator = ({
  showContact,
  className,
  onCompleted,
}: {
  showContact?: boolean;
  className?: string;
  // Human-acceptance repair (Tasks noise): fired straight through to each
  // <Task> row — see useRecentlyCompletedTasks's own header comment.
  // TasksListByDueDate (the only caller, via TaskListFilter) has already
  // filtered/ordered `data` by the time it reaches here — pending Tasks
  // first, any recently-completed ones after — so this component trusts
  // that order rather than re-deriving it.
  onCompleted?: (task: TaskType) => void;
}) => {
  const { data, error, isPending } = useListContext<TaskType>();
  if (isPending || error || data.length === 0) return null;

  return (
    <div className={`space-y-4 md:space-y-2 ${className || ""}`}>
      {data.map((task) => (
        <Task
          task={task}
          showContact={showContact}
          onCompleted={onCompleted}
          key={task.id}
        />
      ))}
    </div>
  );
};
