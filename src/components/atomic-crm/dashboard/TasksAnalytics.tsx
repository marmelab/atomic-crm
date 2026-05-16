import { ResponsiveBar } from "@nivo/bar";
import { BarChart3 } from "lucide-react";
import { useGetIdentity, useGetList } from "ra-core";
import { memo, useMemo } from "react";
import { Card } from "@/components/ui/card";

import { TASK_STATUSES, resolveStatus } from "../tasks/taskStatus";

// Hex values matching the Tailwind classes in taskStatus.ts
const STATUS_HEX: Record<string, string> = {
  draft: "#94a3b8",
  todo: "#60a5fa",
  in_progress: "#f59e0b",
  completed: "#22c55e",
  cancelled: "#f87171",
};

const STATUS_KEYS = TASK_STATUSES.map((s) => s.value);
const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  TASK_STATUSES.map((s) => [s.value, s.label]),
);

const AXIS_STYLE = {
  ticks: { text: { fill: "var(--color-muted-foreground)", fontSize: 11 } },
};

// ---------- sub-components ----------

const KpiTile = ({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: "amber" | "green" | "red";
}) => {
  const bg =
    highlight === "amber"
      ? "bg-amber-50 dark:bg-amber-950"
      : highlight === "green"
        ? "bg-green-50 dark:bg-green-950"
        : highlight === "red" && value > 0
          ? "bg-red-50 dark:bg-red-950"
          : "bg-muted";
  const text =
    highlight === "amber"
      ? "text-amber-800 dark:text-amber-200"
      : highlight === "green"
        ? "text-green-800 dark:text-green-200"
        : highlight === "red" && value > 0
          ? "text-red-700 dark:text-red-300"
          : "text-foreground";
  return (
    <div
      className={`flex flex-col items-center justify-center p-4 rounded-lg ${bg}`}
    >
      <span className={`text-3xl font-bold ${text}`}>{value}</span>
      <span className="text-xs mt-1 text-center text-muted-foreground">
        {label}
      </span>
    </div>
  );
};

const StatusBar = ({
  counts,
  total,
}: {
  counts: Record<string, number>;
  total: number;
}) => {
  if (total === 0) return null;
  return (
    <div>
      <div className="flex h-5 rounded-full overflow-hidden gap-px">
        {TASK_STATUSES.map((s) => {
          const count = counts[s.value] ?? 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={s.value}
              style={{
                width: `${pct}%`,
                backgroundColor: STATUS_HEX[s.value],
              }}
              title={`${s.label}: ${count} (${pct.toFixed(0)}%)`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
        {TASK_STATUSES.map((s) => {
          const count = counts[s.value] ?? 0;
          if (count === 0) return null;
          return (
            <div
              key={s.value}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: STATUS_HEX[s.value] }}
              />
              {s.label}
              <span className="font-semibold text-foreground">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------- main component ----------

export const TasksAnalytics = memo(() => {
  const { identity } = useGetIdentity();
  const isAdmin = (identity as any)?.administrator === true;

  const { data: tasks, isPending } = useGetList(
    "tasks",
    {
      pagination: { page: 1, perPage: 1000 },
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

  const stats = useMemo(() => {
    if (!tasks) return null;
    const counts: Record<string, number> = {};
    STATUS_KEYS.forEach((k) => (counts[k] = 0));
    let overdue = 0;
    const now = new Date().toISOString();
    for (const task of tasks) {
      const st = resolveStatus((task as any).status);
      counts[st] = (counts[st] ?? 0) + 1;
      if (
        !(task as any).done_date &&
        (task as any).due_date < now &&
        st !== "cancelled"
      ) {
        overdue++;
      }
    }
    return { counts, total: tasks.length, overdue };
  }, [tasks]);

  const perPersonData = useMemo(() => {
    if (!tasks || !isAdmin || !salesList.length) return [];
    return salesList
      .map((s: any) => {
        const mine = tasks.filter((t: any) => t.sales_id === s.id);
        if (!mine.length) return null;
        const row: Record<string, any> = {
          person: `${s.first_name} ${s.last_name.charAt(0)}.`,
        };
        STATUS_KEYS.forEach((k) => (row[k] = 0));
        for (const t of mine) {
          const st = resolveStatus((t as any).status);
          row[st] = (row[st] ?? 0) + 1;
        }
        return row;
      })
      .filter(Boolean);
  }, [tasks, salesList, isAdmin]);

  if (isPending || !stats || stats.total === 0) return null;

  const chartHeight = Math.max(180, perPersonData.length * 52 + 40);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <BarChart3 className="text-muted-foreground w-6 h-6 shrink-0" />
        <h2 className="text-xl font-semibold text-muted-foreground">
          Task Analytics
        </h2>
      </div>

      <Card className="p-5 flex flex-col gap-7">
        {/* KPI tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiTile label="Total Tasks" value={stats.total} />
          <KpiTile
            label="In Progress"
            value={stats.counts.in_progress ?? 0}
            highlight="amber"
          />
          <KpiTile
            label="Completed"
            value={stats.counts.completed ?? 0}
            highlight="green"
          />
          <KpiTile label="Overdue" value={stats.overdue} highlight="red" />
        </div>

        {/* Status distribution bar */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Status Breakdown
          </p>
          <StatusBar counts={stats.counts} total={stats.total} />
        </div>

        {/* Per-person stacked bar chart — admin only */}
        {isAdmin && perPersonData.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tasks by Team Member
            </p>
            <div style={{ height: chartHeight }}>
              <ResponsiveBar
                data={perPersonData}
                indexBy="person"
                keys={STATUS_KEYS}
                colors={(bar) => STATUS_HEX[bar.id as string] ?? "#94a3b8"}
                layout="horizontal"
                margin={{ top: 4, right: 24, bottom: 36, left: 90 }}
                padding={0.35}
                valueScale={{ type: "linear" }}
                indexScale={{ type: "band", round: true }}
                enableLabel={false}
                enableGridX={true}
                enableGridY={false}
                axisLeft={{ tickSize: 0, tickPadding: 10, style: AXIS_STYLE }}
                axisBottom={{
                  tickSize: 0,
                  tickPadding: 8,
                  style: AXIS_STYLE,
                  format: (v: number) => (Number.isInteger(v) ? v : ""),
                }}
                tooltip={({ id, value, indexValue }) => (
                  <div className="px-2 py-1 bg-popover border border-border text-popover-foreground rounded shadow text-xs">
                    <span className="font-medium">{indexValue}</span> —{" "}
                    {STATUS_LABEL[id as string]}: <strong>{value}</strong>
                  </div>
                )}
              />
            </div>
            {/* Custom legend */}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-1">
              {TASK_STATUSES.map((s) => (
                <div
                  key={s.value}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_HEX[s.value] }}
                  />
                  {s.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
});
