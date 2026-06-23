import { ResponsivePie } from "@nivo/pie";
import { PieChart } from "lucide-react";
import { useTranslate } from "ra-core";
import { memo, useMemo } from "react";

import { useConfigurationContext } from "../root/ConfigurationContext";
import {
  CHART_PALETTE,
  NIVO_THEME,
  formatCompactCurrency,
  formatCurrency,
  resolveLocale,
} from "./chartTheme";
import { DashboardCard } from "./DashboardCard";
import { useDashboardDeals } from "./useDashboardDeals";

/**
 * Pipeline value distributed across active deal stages, shown as a clean donut
 * with the total in the center plus a readable per-stage list (count, value,
 * share). Replaces the previous "Upcoming Deal Revenue" stacked bars and the
 * separate "Deal Stage Breakdown" so the same data is shown once, clearly.
 */
export const PipelineDonut = memo(() => {
  const translate = useTranslate();
  const { currency } = useConfigurationContext();
  const { dealsByStage, pipelineValue, isPending } = useDashboardDeals();
  const locale = resolveLocale();

  const data = useMemo(
    () =>
      dealsByStage.map((stage, i) => ({
        id: stage.stage,
        label: stage.label,
        value: stage.value,
        count: stage.count,
        color: CHART_PALETTE[i % CHART_PALETTE.length],
      })),
    [dealsByStage],
  );

  if (isPending || data.length === 0) {
    return null;
  }

  const total = data.reduce((sum, d) => sum + d.value, 0) || pipelineValue;

  return (
    <DashboardCard
      title={translate("crm.dashboard.pipeline_by_stage", {
        _: "Pipeline per steg",
      })}
      icon={PieChart}
    >
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        {/* Donut with centered total */}
        <div className="relative h-[200px] w-[200px] shrink-0">
          <ResponsivePie
            data={data}
            margin={{ top: 6, right: 6, bottom: 6, left: 6 }}
            innerRadius={0.68}
            padAngle={1.5}
            cornerRadius={3}
            activeOuterRadiusOffset={6}
            colors={{ datum: "data.color" }}
            borderWidth={0}
            enableArcLabels={false}
            enableArcLinkLabels={false}
            theme={NIVO_THEME}
            tooltip={({ datum }) => (
              <div className="rounded-lg bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: datum.color }}
                  />
                  <span className="font-medium">{datum.data.label}</span>
                </div>
                <div className="mt-0.5 font-semibold">
                  {formatCurrency(datum.value, currency, locale)}
                </div>
              </div>
            )}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {translate("crm.dashboard.pipeline_total", { _: "Totalt" })}
            </span>
            <span className="text-lg font-semibold tabular-nums">
              {formatCompactCurrency(total, currency, locale)}
            </span>
          </div>
        </div>

        {/* Per-stage list */}
        <ul className="flex w-full flex-col gap-2.5">
          {data.map((stage) => {
            const share = total > 0 ? (stage.value / total) * 100 : 0;
            return (
              <li key={stage.id} className="flex items-center gap-3 text-sm">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {stage.label}
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({stage.count})
                  </span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatCompactCurrency(stage.value, currency, locale)}
                </span>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {share.toFixed(0)}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </DashboardCard>
  );
});
