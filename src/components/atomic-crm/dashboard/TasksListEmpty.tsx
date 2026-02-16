import { useGetIdentity, useGetList } from "ra-core";

export const TasksListEmpty = () => {
  const { identity } = useGetIdentity();

  const { total } = useGetList(
    "tasks",
    {
      pagination: { page: 1, perPage: 1 },
      filter: {
        sales_id: identity?.id,
      },
    },
    { enabled: !!identity },
  );

  if (total) return null;

  return (
    <div className="text-center py-6">
      <p className="text-sm text-muted-foreground">
        Tasks added to your contacts will appear here.
      </p>
      <p className="text-sm text-muted-foreground mt-2">
        Create a task from a contact detail page to get started.
      </p>
    </div>
  );
};
