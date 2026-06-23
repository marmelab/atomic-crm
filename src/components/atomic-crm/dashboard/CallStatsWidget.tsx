import { ResponsiveBar } from "@nivo/bar";
import { startOfWeek, startOfMonth, startOfDay } from "date-fns";
import { Phone } from "lucide-react";
import { useGetList } from "ra-core";
import { memo, useMemo, useState } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { CallLog, Sale } from "../types";
import { NIVO_THEME } from "./chartTheme";
import { DashboardCard } from "./DashboardCard";

type Period = "week" | "month" | "all";

const periodLabels: Record<Period, string> = {
  week: "Denna vecka",
  month: "Denna månad",
  all: "Allt",
};

function getPeriodStart(period: Period): Date | null {
  const now = new Date();
  if (period === "week") return startOfWeek(now, { weekStartsOn: 1 });
  if (period === "month") return startOfMonth(now);
  return null;
}

type SalesPersonStats = {
  name: string;
  calls: number;
  meetings: number;
};

export const CallStatsWidget = memo(() => {
  const [period, setPeriod] = useState<Period>("month");

  const periodStart = useMemo(() => getPeriodStart(period), [period]);

  const { data: callLogs, isPending: isPendingCalls } = useGetList<CallLog>(
    "call_logs",
    {
      pagination: { page: 1, perPage: 10000 },
      sort: { field: "created_at", order: "DESC" },
      filter: periodStart
        ? { "created_at@gte": startOfDay(periodStart).toISOString() }
        : {},
    },
  );

  const { data: salesList, isPending: isPendingSales } = useGetList<Sale>(
    "sales",
    {
      pagination: { page: 1, perPage: 100 },
    },
  );

  const isPending = isPendingCalls || isPendingSales;

  const { stats, totalCalls, totalMeetings } = useMemo(() => {
    if (!callLogs || !salesList) {
      return { stats: [], totalCalls: 0, totalMeetings: 0 };
    }

    const salesMap = new Map<string, string>();
    for (const sale of salesList) {
      salesMap.set(sale.user_id, `${sale.first_name} ${sale.last_name}`);
    }

    const byUser = new Map<string, { calls: number; meetings: number }>();

    for (const log of callLogs) {
      const userId = log.user_id ?? "unknown";
      const entry = byUser.get(userId) ?? { calls: 0, meetings: 0 };
      entry.calls += 1;
      if (log.call_outcome === "meeting_booked") {
        entry.meetings += 1;
      }
      byUser.set(userId, entry);
    }

    let totalCalls = 0;
    let totalMeetings = 0;
    const stats: SalesPersonStats[] = [];

    for (const [userId, counts] of byUser) {
      const name = salesMap.get(userId) ?? "Okänd";
      stats.push({
        name,
        calls: counts.calls,
        meetings: counts.meetings,
      });
      totalCalls += counts.calls;
      totalMeetings += counts.meetings;
    }

    stats.sort((a, b) => b.calls - a.calls);

    return { stats, totalCalls, totalMeetings };
  }, [callLogs, salesList]);

  const conversionRate =
    totalCalls > 0 ? ((totalMeetings / totalCalls) * 100).toFixed(1) : "0";

  const title = "Samtalsstatistik";

  if (isPending) {
    return (
      <DashboardCard title={title} icon={Phone}>
        <div className="h-[300px] w-full animate-pulse rounded-md bg-muted" />
      </DashboardCard>
    );
  }

  const periodTabs = (
    <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
      <TabsList>
        {(Object.keys(periodLabels) as Period[]).map((p) => (
          <TabsTrigger key={p} value={p}>
            {periodLabels[p]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  return (
    <DashboardCard
      title={title}
      icon={Phone}
      action={periodTabs}
      contentClassName="flex flex-col gap-5 p-5"
    >
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { value: totalCalls, label: "Samtal totalt" },
          { value: totalMeetings, label: "Möten bokade" },
          { value: `${conversionRate}%`, label: "Konvertering" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border bg-muted/40 p-4 text-center"
          >
            <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {stats.length > 0 ? (
        <div className="h-[280px]">
          <ResponsiveBar
            data={stats}
            indexBy="name"
            keys={["calls", "meetings"]}
            groupMode="grouped"
            colors={["var(--color-chart-1)", "var(--color-chart-2)"]}
            borderRadius={3}
            margin={{ top: 28, right: 16, bottom: 50, left: 44 }}
            padding={0.3}
            valueScale={{ type: "linear" }}
            indexScale={{ type: "band", round: true }}
            enableGridX={false}
            enableGridY={true}
            gridYValues={5}
            enableLabel={false}
            theme={NIVO_THEME}
            tooltip={({ id, value, indexValue, color }) => {
              const label = id === "calls" ? "Samtal" : "Möten bokade";
              return (
                <div className="inline-flex items-center gap-1 rounded-lg bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg">
                  <span
                    className="mr-1 inline-block h-3 w-3 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                  <strong>
                    {indexValue} – {label}:
                  </strong>
                  &nbsp;{value}
                </div>
              );
            }}
            axisBottom={{
              tickSize: 0,
              tickPadding: 12,
              tickRotation: stats.length > 5 ? -30 : 0,
            }}
            axisLeft={{ tickSize: 0, tickPadding: 8, tickValues: 5 }}
            legends={[
              {
                dataFrom: "keys",
                anchor: "top-right",
                direction: "row",
                translateY: -24,
                itemWidth: 120,
                itemHeight: 20,
                itemDirection: "left-to-right",
                symbolSize: 12,
                symbolShape: "circle",
                itemTextColor: "var(--color-muted-foreground)",
                data: [
                  {
                    id: "calls",
                    label: "Samtal",
                    color: "var(--color-chart-1)",
                  },
                  {
                    id: "meetings",
                    label: "Möten bokade",
                    color: "var(--color-chart-2)",
                  },
                ],
              },
            ]}
          />
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Inga samtal registrerade för vald period.
        </p>
      )}
    </DashboardCard>
  );
});
