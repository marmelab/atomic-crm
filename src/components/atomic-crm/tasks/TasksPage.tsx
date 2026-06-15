import { CheckSquare } from "lucide-react";
import { useGetIdentity, useGetList } from "ra-core";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { AddTask } from "./AddTask";
import { TasksKanban } from "./TasksKanban";

export const TasksPage = () => {
  const { identity } = useGetIdentity();
  const { taskTypes } = useConfigurationContext();
  const isAdmin = (identity as any)?.administrator === true;

  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterAssignee, setFilterAssignee] = useState<string>("ALL");
  const [filterPriority, setFilterPriority] = useState<string>("ALL");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const { data: salesList = [] } = useGetList(
    "sales",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "first_name", order: "ASC" },
      filter: { disabled: false },
    },
    { enabled: isAdmin },
  );

  const extraFilter = useMemo(() => {
    const f: Record<string, any> = {};
    if (filterType !== "ALL") f["type@eq"] = filterType;
    if (filterPriority !== "ALL") f["priority@eq"] = filterPriority;
    if (isAdmin && filterAssignee !== "ALL")
      f["sales_id@eq"] = Number(filterAssignee);
    if (overdueOnly) f["due_date@lt"] = new Date().toISOString();
    return f;
  }, [filterType, filterPriority, filterAssignee, overdueOnly, isAdmin]);

  const hasFilters =
    filterType !== "ALL" ||
    filterPriority !== "ALL" ||
    filterAssignee !== "ALL" ||
    overdueOnly;

  return (
    <div className="flex flex-col gap-6 mt-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckSquare className="w-6 h-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Tasks</h1>
        </div>
        <AddTask display="icon" selectContact />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {taskTypes.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isAdmin && (
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All assignees</SelectItem>
              {salesList.map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.first_name} {s.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          variant={overdueOnly ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setOverdueOnly((v) => !v)}
        >
          Overdue only
        </Button>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => {
              setFilterType("ALL");
              setFilterPriority("ALL");
              setFilterAssignee("ALL");
              setOverdueOnly(false);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Kanban board — drag a task between columns to change its status */}
      <TasksKanban
        extraFilter={Object.keys(extraFilter).length ? extraFilter : undefined}
        emptyPlaceholder={
          <p className="text-sm text-muted-foreground">
            {hasFilters
              ? "No tasks match the current filters."
              : isAdmin
                ? "No tasks yet. Create one using the + button above."
                : "No tasks assigned to you yet."}
          </p>
        }
      />
    </div>
  );
};
