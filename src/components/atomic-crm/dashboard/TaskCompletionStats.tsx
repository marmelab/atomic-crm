import { startOfWeek } from "date-fns/startOfWeek";
import { CheckSquare } from "lucide-react";
import { useGetIdentity, useGetList } from "ra-core";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const TaskCompletionStats = () => {
  const { identity } = useGetIdentity();
  const isAdmin = (identity as any)?.administrator === true;

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  const { data: tasks, isPending } = useGetList(
    "tasks",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "due_date", order: "ASC" },
      filter: {},
    },
    { enabled: !!identity },
  );

  const { data: salesList = [] } = useGetList(
    "sales",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "first_name", order: "ASC" },
      filter: { disabled: false },
    },
    { enabled: isAdmin },
  );

  if (isPending || !tasks) return null;

  const pending = tasks.filter((t: any) => !t.done_date);
  const doneThisWeek = tasks.filter(
    (t: any) => t.done_date && new Date(t.done_date) >= weekStart,
  );

  const total = pending.length + doneThisWeek.length;
  const pct = total > 0 ? Math.round((doneThisWeek.length / total) * 100) : 0;

  const byAssignee = isAdmin
    ? salesList
        .map((s: any) => {
          const assigneePending = pending.filter(
            (t: any) => t.sales_id === s.id,
          ).length;
          const assigneeDone = doneThisWeek.filter(
            (t: any) => t.sales_id === s.id,
          ).length;
          return { ...s, pending: assigneePending, done: assigneeDone };
        })
        .filter((s) => s.pending > 0 || s.done > 0)
    : [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <CheckSquare className="text-muted-foreground w-6 h-6 shrink-0" />
        <h2 className="text-xl font-semibold text-muted-foreground flex-1">
          Task Progress
        </h2>
      </div>
      <Card className="p-4">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-2xl font-bold">{doneThisWeek.length}</span>
          <span className="text-sm text-muted-foreground">
            of {total} done this week
          </span>
        </div>
        <Progress value={pct} className="h-2 mb-3" />
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">
              {doneThisWeek.length}
            </span>{" "}
            completed
          </span>
          <span>
            <span className="font-semibold text-foreground">
              {pending.length}
            </span>{" "}
            pending
          </span>
        </div>

        {isAdmin && byAssignee.length > 0 && (
          <div className="mt-3 pt-3 border-t space-y-1.5">
            {byAssignee.map((s: any) => (
              <div
                key={s.id}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-muted-foreground truncate max-w-[120px]">
                  {s.first_name} {s.last_name}
                </span>
                <span>
                  <span className="font-medium">{s.done}</span>
                  <span className="text-muted-foreground">
                    /{s.done + s.pending}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
