import { ResponsiveBar } from "@nivo/bar";
import { startOfWeek, startOfMonth, startOfDay } from "date-fns";
import { Phone } from "lucide-react";
import { useGetList } from "ra-core";
import { memo, useMemo, useState } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { CallLog, Sale } from "../types";

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

  if (isPending) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center mb-4">
          <div className="mr-3 flex">
            <Phone className="text-muted-foreground w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold text-muted-foreground">
            Samtalsstatistik
          </h2>
        </div>
        <div className="h-[400px] flex items-center justify-center">
          <div className="w-full h-full animate-pulse bg-muted rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="mr-3 flex">
            <Phone className="text-muted-foreground w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold text-muted-foreground">
            Samtalsstatistik
          </h2>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            {(Object.keys(periodLabels) as Period[]).map((p) => (
              <TabsTrigger key={p} value={p}>
                {periodLabels[p]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold">{totalCalls}</p>
          <p className="text-sm text-muted-foreground">Samtal totalt</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold">{totalMeetings}</p>
          <p className="text-sm text-muted-foreground">Möten bokade</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold">{conversionRate}%</p>
          <p className="text-sm text-muted-foreground">Konvertering</p>
        </div>
      </div>

      {/* Bar chart */}
      {stats.length > 0 ? (
        <div className="h-[300px]">
          <ResponsiveBar
            data={stats}
            indexBy="name"
            keys={["calls", "meetings"]}
            groupMode="grouped"
            colors={["#3b82f6", "#22c55e"]}
            margin={{ top: 30, right: 20, bottom: 50, left: 50 }}
            padding={0.3}
            valueScale={{ type: "linear" }}
            indexScale={{ type: "band", round: true }}
            enableGridX={false}
            enableGridY={true}
            enableLabel={true}
            labelSkipWidth={16}
            labelSkipHeight={16}
            labelTextColor="var(--color-card)"
            tooltip={({ id, value, indexValue, color }) => {
              const label = id === "calls" ? "Samtal" : "Möten bokade";
              return (
                <div className="p-2 bg-secondary rounded shadow inline-flex items-center gap-1 text-secondary-foreground">
                  <span
                    className="inline-block w-3 h-3 rounded-sm mr-1"
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
            axisLeft={{
              tickSize: 0,
              tickPadding: 8,
              tickValues: 5,
            }}
            theme={{
              axis: {
                ticks: {
                  text: { fill: "var(--color-muted-foreground)" },
                },
              },
              grid: {
                line: { stroke: "var(--color-border)", strokeWidth: 1 },
              },
            }}
            legends={[
              {
                dataFrom: "keys",
                anchor: "top-right",
                direction: "row",
                translateY: -25,
                itemWidth: 120,
                itemHeight: 20,
                itemDirection: "left-to-right",
                symbolSize: 12,
                symbolShape: "square",
                itemTextColor: "var(--color-muted-foreground)",
                data: [
                  { id: "calls", label: "Samtal", color: "#3b82f6" },
                  { id: "meetings", label: "Möten bokade", color: "#22c55e" },
                ],
              },
            ]}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          Inga samtal registrerade för vald period.
        </p>
      )}
    </div>
  );
});
