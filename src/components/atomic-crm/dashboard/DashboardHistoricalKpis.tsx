import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  CircleDollarSign,
  Minus,
  Trophy,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { formatCurrency } from "./dashboardModel";
import type {
  DashboardHistoryModel,
  HistoricalYoY,
} from "./dashboardHistoryModel";

export const DashboardHistoricalKpis = ({
  model,
}: {
  model: DashboardHistoryModel;
}) => {
  const { kpis, meta } = model;

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Total historical revenue */}
      <Card className="gap-0 py-3">
        <CardContent className="px-4 flex items-start gap-3">
          <div className="rounded-md bg-sky-100 p-2 dark:bg-sky-950">
            <CircleDollarSign className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">
              Lavoro totale
            </p>
            <p className="text-lg sm:text-2xl font-bold text-sky-700 dark:text-sky-300 tabular-nums">
              {formatCurrency(kpis.totalHistoricalRevenue)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              al {meta.asOfDateLabel}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Best closed year */}
      <Card className="gap-0 py-3">
        <CardContent className="px-4 flex items-start gap-3">
          <div className="rounded-md bg-emerald-100 p-2 dark:bg-emerald-950">
            <Trophy className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">
              Anno migliore
            </p>
            <p className="text-lg sm:text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
              {kpis.bestClosedYear.revenue == null
                ? "N/D"
                : formatCurrency(kpis.bestClosedYear.revenue)}
            </p>
            {kpis.bestClosedYear.year != null && (
              <p className="text-[11px] text-muted-foreground">
                {kpis.bestClosedYear.year}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Latest closed year */}
      <Card className="gap-0 py-3">
        <CardContent className="px-4 flex items-start gap-3">
          <div className="rounded-md bg-amber-100 p-2 dark:bg-amber-950">
            <CalendarRange className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">
              Ultimo anno
            </p>
            <p className="text-lg sm:text-2xl font-bold text-amber-700 dark:text-amber-300 tabular-nums">
              {kpis.latestClosedYearRevenue.revenue == null
                ? "N/D"
                : formatCurrency(kpis.latestClosedYearRevenue.revenue)}
            </p>
            {kpis.latestClosedYearRevenue.year != null && (
              <p className="text-[11px] text-muted-foreground">
                {kpis.latestClosedYearRevenue.year}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* YoY growth */}
      <Card className="gap-0 py-3">
        <CardContent className="px-4 space-y-2">
          <div className="flex items-start gap-3">
            <YoYIconBadge yoy={kpis.yoyClosedYears} />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                Crescita
              </p>
              <p
                className={`text-lg sm:text-2xl font-bold tabular-nums ${getYoYColor(kpis.yoyClosedYears)}`}
              >
                {kpis.yoyClosedYears.formattedValue}
              </p>
            </div>
          </div>
          <Separator />
          <p className="text-[11px] text-muted-foreground">
            {kpis.yoyClosedYears.comparisonLabel}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

const getYoYColor = (yoy: HistoricalYoY) => {
  if (!yoy.isComparable || yoy.valuePct == null) return "text-muted-foreground";
  if (yoy.valuePct > 0)
    return "text-emerald-700 dark:text-emerald-300";
  if (yoy.valuePct < 0) return "text-red-700 dark:text-red-300";
  return "text-muted-foreground";
};

const YoYIconBadge = ({ yoy }: { yoy: HistoricalYoY }) => {
  if (!yoy.isComparable || yoy.valuePct == null || yoy.valuePct === 0) {
    return (
      <div className="rounded-md bg-muted p-2">
        <Minus className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  if (yoy.valuePct > 0) {
    return (
      <div className="rounded-md bg-emerald-100 p-2 dark:bg-emerald-950">
        <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="rounded-md bg-red-100 p-2 dark:bg-red-950">
      <ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400" />
    </div>
  );
};
