import { Badge } from "@/components/ui/badge";
import { endOfYesterday, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { CheckSquare, Clock, Tag, TrendingUp, Users } from "lucide-react";
import { FilterLiveForm, useGetIdentity, useGetList } from "ra-core";

import { ToggleFilterButton, SearchInput } from "@/components/admin";
import { FilterCategory } from "../filters/FilterCategory";
import { Status } from "../misc/Status";
import { useConfigurationContext } from "../root/ConfigurationContext";

export const ContactListFilter = () => {
  const { noteStatuses } = useConfigurationContext();
  const { identity } = useGetIdentity();
  const { data } = useGetList("tags", {
    pagination: { page: 1, perPage: 10 },
    sort: { field: "name", order: "ASC" },
  });

  return (
    <div className="w-52 min-w-52 order-first pt-0.75 flex flex-col gap-4">
      <FilterLiveForm>
        <SearchInput source="q" placeholder="Search name, company..." />
      </FilterLiveForm>

      <FilterCategory label="Last activity" icon={<Clock />}>
        <ToggleFilterButton
          label="Today"
          value={{
            "last_seen@gte": endOfYesterday().toISOString(),
            "last_seen@lte": undefined,
          }}
        />
        <ToggleFilterButton
          label="This week"
          value={{
            "last_seen@gte": startOfWeek(new Date()).toISOString(),
            "last_seen@lte": undefined,
          }}
        />
        <ToggleFilterButton
          label="Before this week"
          value={{
            "last_seen@gte": undefined,
            "last_seen@lte": startOfWeek(new Date()).toISOString(),
          }}
        />
        <ToggleFilterButton
          label="Before this month"
          value={{
            "last_seen@gte": undefined,
            "last_seen@lte": startOfMonth(new Date()).toISOString(),
          }}
        />
        <ToggleFilterButton
          label="Before last month"
          value={{
            "last_seen@gte": undefined,
            "last_seen@lte": subMonths(
              startOfMonth(new Date()),
              1,
            ).toISOString(),
          }}
        />
      </FilterCategory>

      <FilterCategory label="Status" icon={<TrendingUp />}>
        {noteStatuses.map((status) => (
          <ToggleFilterButton
            key={status.value}
            label={
              <>
                {status.label} <Status status={status.value} />
              </>
            }
            value={{ status: status.value }}
          />
        ))}
      </FilterCategory>

      <FilterCategory label="Tags" icon={<Tag />}>
        {data &&
          data.map((record) => (
            <ToggleFilterButton
              key={record.id}
              label={
                <Badge
                  variant="secondary"
                  className="text-xs cursor-pointer"
                  style={{
                    backgroundColor: record?.color,
                    color: "white",
                  }}
                >
                  {record?.name}
                </Badge>
              }
              value={{ "tags@cs": `{${record.id}}` }}
            />
          ))}
      </FilterCategory>

      <FilterCategory icon={<CheckSquare className="h-4 w-4" />} label="Tasks">
        <ToggleFilterButton
          label={"With pending tasks"}
          value={{ "nb_tasks@gt": 0 }}
        />
      </FilterCategory>

      <FilterCategory
        icon={<Users className="h-4 w-4" />}
        label="Account Manager"
      >
        <ToggleFilterButton label={"Me"} value={{ sales_id: identity?.id }} />
      </FilterCategory>
    </div>
  );
};
