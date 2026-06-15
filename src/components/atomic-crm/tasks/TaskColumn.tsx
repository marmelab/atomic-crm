import { Droppable } from "@hello-pangea/dnd";

import type { Task } from "../types";
import { TaskKanbanCard } from "./TaskKanbanCard";
import type { TASK_STATUSES } from "./taskStatus";

type StatusMeta = (typeof TASK_STATUSES)[number];

export const TaskColumn = ({
  status,
  tasks,
  showContact,
  showAssignee,
}: {
  status: StatusMeta;
  tasks: Task[];
  showContact?: boolean;
  showAssignee?: boolean;
}) => {
  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${status.color}`}
        >
          {status.label}
        </span>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>

      <Droppable droppableId={status.value}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex flex-col gap-2 rounded-md p-2 min-h-24 flex-1 transition-colors ${
              snapshot.isDraggingOver ? "bg-muted" : "bg-muted/40"
            }`}
          >
            {tasks.map((task, index) => (
              <TaskKanbanCard
                key={task.id}
                task={task}
                index={index}
                showContact={showContact}
                showAssignee={showAssignee}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};
