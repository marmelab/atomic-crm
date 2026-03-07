import { useRecordContext } from "ra-core";

import { taskFilters } from "../tasks/taskFilters";
import { TasksListFilter } from "../dashboard/TasksListFilter";
import { AddTask } from "../tasks/AddTask";

export const SupplierTasksSection = () => {
  const record = useRecordContext();
  if (!record) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Promemoria
        </h3>
        <AddTask display="icon" context="supplier" />
      </div>
      <div className="flex flex-col gap-4">
        <TasksListFilter
          title="In ritardo"
          filter={taskFilters.overdue}
          filterBySupplier={record.id}
        />
        <TasksListFilter
          title="Oggi"
          filter={taskFilters.today}
          filterBySupplier={record.id}
        />
        <TasksListFilter
          title="Prossimi"
          filter={taskFilters.later}
          filterBySupplier={record.id}
        />
      </div>
    </div>
  );
};
