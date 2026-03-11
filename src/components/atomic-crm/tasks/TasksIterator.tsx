import { useListContext } from "ra-core";

import { Task } from "./Task";
import { isDone, isRecentlyDone } from "./tasksPredicate";

export const TasksIterator = ({
  showContact,
  className,
  includeDoneTasks = false,
  showAsArchived = false,
}: {
  showContact?: boolean;
  className?: string;
  includeDoneTasks?: boolean;
  showAsArchived?: boolean;
}) => {
  const { data, error, isPending } = useListContext();
  if (isPending || error || data.length === 0) return null;

  // Keep only tasks that are not done or done less than 5 minutes ago
  const tasks = includeDoneTasks
    ? data
    : data.filter((task) => !isDone(task) || isRecentlyDone(task));

  return (
    <div className={`space-y-4 md:space-y-2 ${className || ""}`}>
      {tasks.map((task) => (
        <Task
          task={task}
          showContact={showContact}
          showAsArchived={showAsArchived}
          key={task.id}
        />
      ))}
    </div>
  );
};
