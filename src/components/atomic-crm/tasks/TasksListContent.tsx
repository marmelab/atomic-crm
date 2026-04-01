import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Calendar, X } from "lucide-react";
import { taskFilters, isBeforeFriday } from "./taskFilters";
import { TasksListEmpty } from "../dashboard/TasksListEmpty";
import { TasksListFilter } from "../dashboard/TasksListFilter";
import {
  endOfBusinessDayISOString,
  startOfBusinessDayISOString,
} from "@/lib/dateTimezone";

export const TasksListContent = () => {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const hasDateFilter = dateFrom || dateTo;
  const hasError = dateFrom && dateTo && dateFrom > dateTo;

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (dateTo && value && value > dateTo) return;
    setDateFrom(value);
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (dateFrom && value && value < dateFrom) return;
    setDateTo(value);
  };

  const clearDateFilter = () => {
    setDateFrom("");
    setDateTo("");
  };

  const dateRangeFilter: Record<string, string> = {
    "done_date@is": null as unknown as string,
    ...(dateFrom
      ? {
          "due_date@gte": startOfBusinessDayISOString(dateFrom) ?? dateFrom,
        }
      : {}),
    ...(dateTo
      ? {
          "due_date@lte":
            endOfBusinessDayISOString(dateTo) ?? `${dateTo}T23:59:59.999Z`,
        }
      : {}),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Calendar className="size-4 text-muted-foreground shrink-0" />
        <div className="flex items-center gap-2 flex-1">
          <Input
            type="date"
            className="h-8 text-sm"
            placeholder="Da"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={handleFromChange}
          />
          <span className="text-xs text-muted-foreground">—</span>
          <Input
            type="date"
            className="h-8 text-sm"
            placeholder="A"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={handleToChange}
          />
          {hasDateFilter && (
            <button
              type="button"
              onClick={clearDateFilter}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Rimuovi filtro data"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>
      {hasError && (
        <p className="text-xs text-destructive">
          La data iniziale deve essere precedente alla finale
        </p>
      )}

      {hasDateFilter && !hasError ? (
        <TasksListFilter title="Risultati" filter={dateRangeFilter} />
      ) : (
        <>
          <TasksListEmpty />
          <TasksListFilter title="In ritardo" filter={taskFilters.overdue} />
          <TasksListFilter title="Oggi" filter={taskFilters.today} />
          <TasksListFilter title="Domani" filter={taskFilters.tomorrow} />
          {isBeforeFriday && (
            <TasksListFilter
              title="Questa settimana"
              filter={taskFilters.thisWeek}
            />
          )}
          <TasksListFilter title="Più avanti" filter={taskFilters.later} />
        </>
      )}
    </div>
  );
};
