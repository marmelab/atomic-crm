import { CheckCircle2 } from "lucide-react";

import { Separator } from "@/components/ui/separator";

import { formatFullCurrency } from "./dashboardDeadlineTrackerFormatters";

type DotColor = "red" | "amber" | "blue";

const counterColors: Record<DotColor, { count: string; label: string }> = {
  red: {
    count: "text-red-700 dark:text-red-300",
    label: "text-red-600 dark:text-red-400",
  },
  amber: {
    count: "text-amber-700 dark:text-amber-300",
    label: "text-amber-600 dark:text-amber-400",
  },
  blue: {
    count: "text-blue-700 dark:text-blue-300",
    label: "text-blue-600 dark:text-blue-400",
  },
};

export const DashboardDeadlineTrackerEmptyState = () => (
  <div className="flex items-center justify-center gap-2 rounded-md bg-emerald-100 py-4 text-sm font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
    <CheckCircle2 className="h-4 w-4" />
    Tutto in ordine
  </div>
);

export const DashboardDeadlineTrackerSummary = ({
  dueSoonCount,
  dueSoonTotal,
  otherCount,
  overdueCount,
  overdueTotal,
}: {
  dueSoonCount: number;
  dueSoonTotal: number;
  otherCount: number;
  overdueCount: number;
  overdueTotal: number;
}) => (
  <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-0">
    <CounterColumn
      count={overdueCount}
      label="Scaduti"
      amount={overdueTotal}
      color="red"
    />
    <Separator orientation="vertical" />
    <CounterColumn
      count={dueSoonCount}
      label="Prossimi 7g"
      amount={dueSoonTotal}
      color="amber"
    />
    <Separator orientation="vertical" />
    <CounterColumn count={otherCount} label="Da fare" color="blue" />
  </div>
);

const CounterColumn = ({
  count,
  label,
  amount,
  color,
}: {
  count: number;
  label: string;
  amount?: number;
  color: DotColor;
}) => {
  const colors = counterColors[color];

  return (
    <div className="space-y-0.5 px-2 text-center">
      <div className={`text-2xl font-bold tabular-nums ${colors.count}`}>
        {count}
      </div>
      <div
        className={`text-xs font-semibold uppercase tracking-wide ${colors.label}`}
      >
        {label}
      </div>
      {amount != null && amount > 0 && (
        <div className="text-[11px] tabular-nums text-muted-foreground">
          {formatFullCurrency(amount)}
        </div>
      )}
    </div>
  );
};
