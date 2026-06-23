import { ResponsiveBar } from "@nivo/bar";
import { format } from "date-fns";
import { Plus, Trash2, TrendingUp } from "lucide-react";
import { useDelete, useGetList, useTranslate } from "ra-core";
import { memo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { SalesEntry } from "../types";
import { NIVO_THEME, formatCurrency, resolveLocale } from "./chartTheme";
import { DashboardCard } from "./DashboardCard";
import { SalesEntryDialog } from "./SalesEntryDialog";
import { type PeriodType, useSalesTracking } from "./useSalesTracking";

export const SalesTrackingWidget = memo(() => {
  const translate = useTranslate();
  const { currency } = useConfigurationContext();
  const locale = resolveLocale();

  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteEntry] = useDelete();

  const { periods, totalManual, totalDeals, isPending } =
    useSalesTracking(periodType);

  const { data: recentEntries } = useGetList<SalesEntry>("sales_entries", {
    pagination: { perPage: 10, page: 1 },
    sort: { field: "period_date", order: "DESC" },
  });

  const handleDelete = (id: SalesEntry["id"]) => {
    deleteEntry("sales_entries", { id });
  };

  const title = translate("crm.dashboard.sales_tracking.title", {
    _: "Försäljningslogg",
  });
  const manualLabel = translate("crm.dashboard.sales_tracking.manual", {
    _: "Manuell försäljning",
  });
  const dealLabel = translate("crm.dashboard.sales_tracking.deals", {
    _: "Deal-intäkt",
  });

  if (isPending) {
    return (
      <DashboardCard title={title} icon={TrendingUp}>
        <div className="h-[300px] w-full animate-pulse rounded-md bg-muted" />
      </DashboardCard>
    );
  }

  const addButton = (
    <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
      <Plus className="mr-1 h-4 w-4" />
      {translate("crm.dashboard.sales_tracking.add", { _: "Lägg till" })}
    </Button>
  );

  return (
    <DashboardCard
      title={title}
      icon={TrendingUp}
      action={addButton}
      contentClassName="flex flex-col gap-4 p-5"
    >
      <Tabs
        value={periodType}
        onValueChange={(v) => setPeriodType(v as PeriodType)}
      >
        <TabsList>
          <TabsTrigger value="day">
            {translate("crm.dashboard.sales_tracking.day", { _: "Dag" })}
          </TabsTrigger>
          <TabsTrigger value="week">
            {translate("crm.dashboard.sales_tracking.week", { _: "Vecka" })}
          </TabsTrigger>
          <TabsTrigger value="month">
            {translate("crm.dashboard.sales_tracking.month", { _: "Månad" })}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="h-[280px]">
        <ResponsiveBar
          data={periods.map((p) => ({
            period: p.periodLabel,
            [manualLabel]: p.manualSales,
            [dealLabel]: p.dealRevenue,
          }))}
          indexBy="period"
          keys={[manualLabel, dealLabel]}
          colors={["var(--color-chart-1)", "var(--color-chart-2)"]}
          borderRadius={3}
          margin={{ top: 20, right: 16, bottom: 40, left: 0 }}
          padding={0.35}
          groupMode="stacked"
          valueScale={{ type: "linear" }}
          indexScale={{ type: "band", round: true }}
          enableGridX={false}
          enableGridY={true}
          gridYValues={5}
          enableLabel={false}
          theme={NIVO_THEME}
          tooltip={({ id, value, indexValue, color }) => (
            <div className="inline-flex items-center gap-1 rounded-lg bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg">
              <span
                className="mr-1 inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <strong>
                {indexValue} – {id}:
              </strong>
              &nbsp;{formatCurrency(value, currency, locale)}
            </div>
          )}
          axisBottom={{
            tickSize: 0,
            tickPadding: 8,
            tickRotation: periodType === "day" ? -45 : 0,
          }}
          axisLeft={null}
          axisRight={{
            format: (v) => `${Math.round(v / 1000)}k`,
            tickValues: 5,
          }}
          legends={[
            {
              dataFrom: "keys",
              anchor: "top-left",
              direction: "row",
              translateY: -20,
              itemWidth: 150,
              itemHeight: 16,
              symbolSize: 12,
              symbolShape: "circle",
              itemTextColor: "var(--color-muted-foreground)",
            },
          ]}
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground">
            {translate("crm.dashboard.sales_tracking.manual_total", {
              _: "Manuellt registrerat",
            })}
          </span>
          <span className="font-semibold tabular-nums text-[var(--color-chart-1)]">
            {formatCurrency(totalManual, currency, locale)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground">
            {translate("crm.dashboard.sales_tracking.deals_total", {
              _: "Vunna deals",
            })}
          </span>
          <span className="font-semibold tabular-nums text-[var(--color-chart-2)]">
            {formatCurrency(totalDeals, currency, locale)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground">
            {translate("crm.dashboard.sales_tracking.combined_total", {
              _: "Totalt",
            })}
          </span>
          <span className="font-semibold tabular-nums">
            {formatCurrency(totalManual + totalDeals, currency, locale)}
          </span>
        </div>
      </div>

      {/* Recent manual entries */}
      {recentEntries && recentEntries.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {translate("crm.dashboard.sales_tracking.recent_entries", {
              _: "Senaste registreringar",
            })}
          </h3>
          <div className="divide-y rounded-lg border">
            {recentEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-medium tabular-nums">
                    {formatCurrency(entry.amount, currency, locale)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(entry.period_date), "d MMM yyyy")} ·{" "}
                    {entry.period_type === "day"
                      ? translate("crm.dashboard.sales_tracking.day", {
                          _: "Dag",
                        })
                      : entry.period_type === "week"
                        ? translate("crm.dashboard.sales_tracking.week", {
                            _: "Vecka",
                          })
                        : translate("crm.dashboard.sales_tracking.month", {
                            _: "Månad",
                          })}
                    {entry.description && ` · ${entry.description}`}
                  </span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(entry.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <SalesEntryDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        periodType={periodType}
      />
    </DashboardCard>
  );
});
