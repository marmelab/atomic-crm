import {
  type Identifier,
  ListContextProvider,
  ResourceContextProvider,
  useGetList,
  useList,
} from "ra-core";

import { TasksIterator } from "../tasks/TasksIterator";
import { useIsMobile } from "@/hooks/use-mobile";

export const TasksListFilter = ({
  title,
  filter,
  filterByClient,
  filterBySupplier,
}: {
  title: string;
  filter: any;
  filterByClient?: Identifier;
  filterBySupplier?: Identifier;
}) => {
  const isMobile = useIsMobile();

  const {
    data: tasks,
    total,
    isPending,
  } = useGetList("client_tasks", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "due_date", order: "ASC" },
    filter: {
      ...filter,
      ...(filterByClient != null ? { client_id: filterByClient } : {}),
      ...(filterBySupplier != null ? { supplier_id: filterBySupplier } : {}),
    },
  });

  const listContext = useList({
    data: tasks,
    isPending,
    resource: "client_tasks",
    perPage: isMobile ? 10 : 5,
  });

  if (isPending || !tasks || !total) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
        {title}
      </p>
      <ResourceContextProvider value="client_tasks">
        <ListContextProvider value={listContext}>
          <TasksIterator
            showClient={filterByClient == null && filterBySupplier == null}
          />
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
            Carica altri
          </a>
        </div>
      )}
    </div>
  );
};
