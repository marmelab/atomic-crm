import {
  startOfMonth,
  startOfWeek,
  startOfQuarter,
  startOfYear,
  endOfMonth,
  endOfWeek,
  endOfQuarter,
  endOfYear,
  format,
} from "date-fns";
import { Goal } from "lucide-react";
import { useGetList, useTranslate } from "ra-core";
import { memo, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import type { RevenueGoal } from "../root/ConfigurationContext";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { DashboardCard } from "./DashboardCard";

const DEFAULT_LOCALE = "en-US";

function getPeriodRange(period: RevenueGoal["period"]): {
  start: Date;
  end: Date;
  label: string;
} {
  const now = new Date();
  switch (period) {
    case "weekly":
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
        label: `${format(startOfWeek(now, { weekStartsOn: 1 }), "d MMM")} – ${format(endOfWeek(now, { weekStartsOn: 1 }), "d MMM")}`,
      };
    case "monthly":
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
        label: format(now, "MMMM yyyy"),
      };
    case "quarterly":
      return {
        start: startOfQuarter(now),
        end: endOfQuarter(now),
        label: `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`,
      };
    case "yearly":
      return {
        start: startOfYear(now),
        end: endOfYear(now),
        label: `${now.getFullYear()}`,
      };
  }
}

export const RevenueGoalsTracker = memo(() => {
  const translate = useTranslate();
  const { revenueGoals, currency } = useConfigurationContext();
  const locale =
    navigator?.languages?.[0] ?? navigator?.language ?? DEFAULT_LOCALE;

  const { data: deals, isPending } = useGetList<Deal>("deals", {
    pagination: { perPage: 1000, page: 1 },
    sort: { field: "expected_closing_date", order: "ASC" },
    filter: { "archived_at@is": null, "stage@eq": "won" },
  });

  const goalProgress = useMemo(() => {
    if (!deals || !revenueGoals?.length) return [];

    return revenueGoals.map((goal) => {
      const { start, end, label: periodLabel } = getPeriodRange(goal.period);

      const revenue = deals
        .filter((deal) => {
          const date = new Date(deal.expected_closing_date);
          return date >= start && date <= end;
        })
        .reduce((sum, deal) => sum + deal.amount, 0);

      const percentage =
        goal.amount > 0 ? Math.min((revenue / goal.amount) * 100, 100) : 0;

      return {
        ...goal,
        revenue,
        percentage,
        periodLabel,
      };
    });
  }, [deals, revenueGoals]);

  if (!revenueGoals?.length || isPending) {
    return null;
  }

  return (
    <DashboardCard
      title={translate("crm.dashboard.revenue_goals", { _: "Säljmål" })}
      icon={Goal}
      contentClassName="flex flex-col gap-5 p-5"
    >
      {goalProgress.map((goal, index) => (
        <div key={index} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{goal.label}</span>
              <Badge variant="outline" className="text-xs">
                {goal.periodLabel}
              </Badge>
            </div>
            <span className="text-sm font-semibold">
              {goal.percentage.toFixed(0)}%
            </span>
          </div>
          <Progress
            value={goal.percentage}
            className="h-3"
            style={
              {
                "--color-primary":
                  goal.percentage >= 100
                    ? "var(--color-chart-2)"
                    : goal.percentage >= 50
                      ? "var(--color-chart-3)"
                      : "var(--color-primary)",
              } as React.CSSProperties
            }
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {goal.revenue.toLocaleString(locale, {
                style: "currency",
                currency,
                maximumFractionDigits: 0,
              })}{" "}
              {translate("crm.dashboard.revenue_goals.of", { _: "of" })}{" "}
              {goal.amount.toLocaleString(locale, {
                style: "currency",
                currency,
                maximumFractionDigits: 0,
              })}
            </span>
            {goal.percentage >= 100 && (
              <span className="text-green-600 font-medium">
                {translate("crm.dashboard.revenue_goals.reached", {
                  _: "Goal reached!",
                })}
              </span>
            )}
          </div>
        </div>
      ))}
    </DashboardCard>
  );
});
