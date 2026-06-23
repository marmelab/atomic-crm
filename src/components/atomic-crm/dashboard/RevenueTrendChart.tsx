import { ResponsiveBar } from "@nivo/bar";
import { TrendingUp } from "lucide-react";
import { useTranslate } from "ra-core";
import { memo, useMemo } from "react";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { RevenueGoal } from "../root/ConfigurationContext";
import {
  NIVO_THEME,
  formatAxisValue,
  formatCurrency,
  resolveLocale,
} from "./chartTheme";
import { DashboardCard } from "./DashboardCard";
import { useDashboardDeals } from "./useDashboardDeals";

/**
 * Monthly won revenue as clean vertical bars — replaces the previous wavy area
 * line, which was hard to read. One brand color, light horizontal gridlines and
 * an optional monthly-goal marker keep it readable and professional.
 */
export const RevenueTrendChart = memo(() => {
  const translate = useTranslate();
  const { currency, revenueGoals } = useConfigurationContext();
  const { monthlyRevenue, isPending } = useDashboardDeals();
  const locale = resolveLocale();

  const chartData = useMemo(
    () =>
      monthlyRevenue.map((m) => ({
        month: m.month.split(" ")[0],
        fullMonth: m.month,
        won: m.won,
      })),
    [monthlyRevenue],
  );

  const monthlyGoal = useMemo(() => {
    const goals = (revenueGoals ?? []).filter(
      (g: RevenueGoal) => g.period === "monthly" && g.amount > 0,
    );
    return goals[0];
  }, [revenueGoals]);

  const title = translate("crm.dashboard.revenue_trend", {
    _: "Intäkt per månad",
  });

  if (isPending) {
    return (
      <DashboardCard title={title} icon={TrendingUp}>
        <div className="h-[260px] w-full animate-pulse rounded-md bg-muted" />
      </DashboardCard>
    );
  }

  if (!monthlyRevenue.some((m) => m.won > 0)) {
    return null;
  }

  return (
    <DashboardCard title={title} icon={TrendingUp}>
      <div className="h-[260px]">
        <ResponsiveBar
          data={chartData}
          keys={["won"]}
          indexBy="month"
          margin={{ top: 12, right: 16, bottom: 28, left: 52 }}
          padding={0.35}
          colors={["var(--color-chart-1)"]}
          borderRadius={4}
          enableLabel={false}
          enableGridX={false}
          enableGridY={true}
          gridYValues={5}
          axisBottom={{ tickSize: 0, tickPadding: 10 }}
          axisLeft={{
            tickSize: 0,
            tickPadding: 8,
            tickValues: 5,
            format: (v: number) => formatAxisValue(v),
          }}
          theme={NIVO_THEME}
          tooltip={({ data, value }) => (
            <div className="rounded-lg bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg">
              <p className="mb-0.5 font-medium">
                {(data as { fullMonth: string }).fullMonth}
              </p>
              <p className="font-semibold tabular-nums">
                {formatCurrency(value, currency, locale)}
              </p>
            </div>
          )}
          markers={
            monthlyGoal
              ? [
                  {
                    axis: "y",
                    value: monthlyGoal.amount,
                    lineStyle: {
                      stroke: "var(--color-muted-foreground)",
                      strokeWidth: 1.5,
                      strokeDasharray: "5 4",
                    },
                    legend: monthlyGoal.label,
                    legendPosition: "top-right",
                    textStyle: {
                      fill: "var(--color-muted-foreground)",
                      fontSize: 11,
                      fontWeight: 600,
                    },
                  },
                ]
              : undefined
          }
        />
      </div>
    </DashboardCard>
  );
});
