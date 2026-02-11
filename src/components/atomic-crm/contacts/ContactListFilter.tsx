import { endOfYesterday, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { CheckSquare, Clock, Tag, TrendingUp, Users } from "lucide-react";
import { useGetIdentity, useGetList, useListContext } from "ra-core";
import { ToggleFilterButton } from "@/components/admin/toggle-filter-button";
import { Badge } from "@/components/ui/badge";

import { FilterCategory } from "../filters/FilterCategory";
import { Status } from "../misc/Status";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { ResponsiveFilters } from "../misc/ResponsiveFilters";
import { useIsMobile } from "@/hooks/use-mobile";
import { ActiveFilterButton } from "../misc/ActiveFilterButton";

export const ContactListFilter = () => {
  const { noteStatuses } = useConfigurationContext();
  const isMobile = useIsMobile();
  const { identity } = useGetIdentity();
  const { data } = useGetList("tags", {
    pagination: { page: 1, perPage: 10 },
    sort: { field: "name", order: "ASC" },
  });

  return (
    <ResponsiveFilters searchInput={{ placeholder: "Search name, company..." }}>
      <FilterCategory label="Last activity" icon={<Clock />}>
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="Today"
          value={{
            "last_seen@gte": endOfYesterday().toISOString(),
            "last_seen@lte": undefined,
          }}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="This week"
          value={{
            "last_seen@gte": startOfWeek(new Date()).toISOString(),
            "last_seen@lte": undefined,
          }}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="Before this week"
          value={{
            "last_seen@gte": undefined,
            "last_seen@lte": startOfWeek(new Date()).toISOString(),
          }}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="Before this month"
          value={{
            "last_seen@gte": undefined,
            "last_seen@lte": startOfMonth(new Date()).toISOString(),
          }}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="Before last month"
          value={{
            "last_seen@gte": undefined,
            "last_seen@lte": subMonths(
              startOfMonth(new Date()),
              1,
            ).toISOString(),
          }}
          size={isMobile ? "lg" : undefined}
        />
      </FilterCategory>

      <FilterCategory label="Status" icon={<TrendingUp />}>
        {noteStatuses.map((status) => (
          <ToggleFilterButton
            key={status.value}
            className="w-auto md:w-full justify-between h-10 md:h-8"
            label={
              <span>
                {status.label} <Status status={status.value} />
              </span>
            }
            value={{ status: status.value }}
            size={isMobile ? "lg" : undefined}
          />
        ))}
      </FilterCategory>

      <FilterCategory label="Tags" icon={<Tag />}>
        {data &&
          data.map((record) => (
            <ToggleFilterButton
              className="w-auto md:w-full justify-between h-10 md:h-8"
              key={record.id}
              label={
                <Badge
                  variant="secondary"
                  className="text-black text-sm md:text-xs font-normal cursor-pointer"
                  style={{
                    backgroundColor: record?.color,
                  }}
                >
                  {record?.name}
                </Badge>
              }
              value={{ "tags@cs": `{${record.id}}` }}
              size={isMobile ? "lg" : undefined}
            />
          ))}
      </FilterCategory>

      <FilterCategory icon={<CheckSquare />} label="Tasks">
        <ToggleFilterButton
          className="w-full justify-between h-10 md:h-8"
          label={"With pending tasks"}
          value={{ "nb_tasks@gt": 0 }}
          size={isMobile ? "lg" : undefined}
        />
      </FilterCategory>

      <FilterCategory icon={<Users />} label="Account Manager">
        <ToggleFilterButton
          className="w-full justify-between h-10 md:h-8"
          label={"Me"}
          value={{ sales_id: identity?.id }}
          size={isMobile ? "lg" : undefined}
        />
      </FilterCategory>
    </ResponsiveFilters>
  );
};

export const ContactListFilterSummary = () => {
  const { noteStatuses } = useConfigurationContext();
  const { identity } = useGetIdentity();
  const { data } = useGetList("tags", {
    pagination: { page: 1, perPage: 10 },
    sort: { field: "name", order: "ASC" },
  });
  const { filterValues } = useListContext();
  const hasFilters = !!Object.entries(filterValues || {}).filter(
    ([key]) => key !== "q",
  ).length;

  if (!hasFilters) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-start mb-4 gap-1">
      <ActiveFilterButton
        className="w-auto justify-between h-8"
        label="Today"
        value={{
          "last_seen@gte": endOfYesterday().toISOString(),
          "last_seen@lte": undefined,
        }}
      />
      <ActiveFilterButton
        className="w-auto justify-between h-8"
        label="This week"
        value={{
          "last_seen@gte": startOfWeek(new Date()).toISOString(),
          "last_seen@lte": undefined,
        }}
      />
      <ActiveFilterButton
        className="w-auto justify-between h-8"
        label="Before this week"
        value={{
          "last_seen@gte": undefined,
          "last_seen@lte": startOfWeek(new Date()).toISOString(),
        }}
      />
      <ActiveFilterButton
        className="w-auto justify-between h-8"
        label="Before this month"
        value={{
          "last_seen@gte": undefined,
          "last_seen@lte": startOfMonth(new Date()).toISOString(),
        }}
      />
      <ActiveFilterButton
        className="w-auto justify-between h-8"
        label="Before last month"
        value={{
          "last_seen@gte": undefined,
          "last_seen@lte": subMonths(startOfMonth(new Date()), 1).toISOString(),
        }}
      />

      {noteStatuses.map((status) => (
        <ActiveFilterButton
          key={status.value}
          className="w-auto justify-between h-8"
          label={
            <span>
              {status.label} <Status status={status.value} />
            </span>
          }
          value={{ status: status.value }}
        />
      ))}

      {data &&
        data.map((record) => (
          <ActiveFilterButton
            className="w-auto justify-between h-8"
            key={record.id}
            label={
              <Badge
                variant="secondary"
                className="text-black text-sm md:text-xs font-normal cursor-pointer"
                style={{
                  backgroundColor: record?.color,
                }}
              >
                {record?.name}
              </Badge>
            }
            value={{ "tags@cs": `{${record.id}}` }}
          />
        ))}

      <ActiveFilterButton
        className="w-auto justify-between h-8"
        label={"With pending tasks"}
        value={{ "nb_tasks@gt": 0 }}
      />

      <ActiveFilterButton
        className="w-auto justify-between h-8"
        label={"Managed by me"}
        value={{ sales_id: identity?.id }}
      />
    </div>
  );
};
