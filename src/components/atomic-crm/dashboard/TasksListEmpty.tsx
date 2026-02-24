import { useGetIdentity, useGetList, useTranslate } from "ra-core";

export const TasksListEmpty = () => {
  const { identity } = useGetIdentity();
  const translate = useTranslate();

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
    <p className="text-sm">
      {translate("crm.tasks.empty", {
        _: "Tasks added to your contacts will appear here.",
      })}
    </p>
  );
};
