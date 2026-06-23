import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { memo } from "react";

import { Card, CardContent } from "@/components/ui/card";

interface KpiCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    direction: "up" | "down" | "flat";
  };
  /**
   * @deprecated No longer used for the icon chip — KPI cards now share one
   * cohesive brand-tinted style instead of clashing per-card colors. Kept
   * optional so existing callers don't break.
   */
  color?: string;
}

const trendColors = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-red-500",
  flat: "text-muted-foreground",
};

const TrendIcon = {
  up: ArrowUp,
  down: ArrowDown,
  flat: Minus,
};

export const KpiCard = memo(
  ({ title, value, icon: Icon, trend }: KpiCardProps) => {
    const TIcon = trend ? TrendIcon[trend.direction] : null;
    return (
      <Card className="py-0 gap-0 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]">
        <CardContent className="flex flex-col gap-2.5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground truncate">
              {title}
            </p>
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0">
              <Icon className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 min-w-0">
            <p className="text-2xl font-semibold tracking-tight tabular-nums truncate">
              {value}
            </p>
            {trend && TIcon && (
              <span
                className={`flex items-center text-xs font-medium shrink-0 ${trendColors[trend.direction]}`}
              >
                <TIcon className="w-3 h-3 mr-0.5" />
                {Math.abs(trend.value).toFixed(0)}%
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  },
);
