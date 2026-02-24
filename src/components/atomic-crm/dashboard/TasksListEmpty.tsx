import { useGetIdentity, useGetList, useTranslate } from "ra-core";

export const TasksListEmpty = () => {
  const translate = useTranslate();
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
    <p className="text-sm">
      {translate("crm.tasks.empty_list_hint", {
        _: "Tasks added to your contacts will appear here.",
      })}
    </p>
  );
};
