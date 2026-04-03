import { ResponsiveBar } from "@nivo/bar";
import { addMonths, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { useGetList } from "ra-core";
import { memo, useMemo } from "react";

import { Card } from "@/components/ui/card";

import type { Deal } from "../types";

const multiplier = {
  lead: 0.1,
  qualified: 0.3,
  "follow-up": 0.5,
  trial: 0.8,
};

const DEFAULT_LOCALE = "fr-FR";
const CURRENCY = "EUR";

// Range: 2 months ago → 10 months ahead
const rangeStart = subMonths(new Date(), 2).toISOString();

export const DealsChart = memo(() => {
  const acceptedLanguages = navigator
    ? navigator.languages || [navigator.language]
    : [DEFAULT_LOCALE];

  const { data, isPending } = useGetList<Deal>("deals", {
    pagination: { perPage: 500, page: 1 },
    sort: {
      field: "expected_closing_date",
      order: "ASC",
    },
    filter: {
      "expected_closing_date@gte": rangeStart.split("T")[0],
      "company_type@is": null,
    },
  });

  const months = useMemo(() => {
    if (!data) return [];

    // Build a map of all months in the range (2 months ago → 10 months ahead)
    const now = new Date();
    const monthKeys: string[] = [];
    for (let i = -2; i <= 10; i++) {
      monthKeys.push(startOfMonth(addMonths(now, i)).toISOString());
    }

    const dealsByMonth: Record<string, Deal[]> = {};
    monthKeys.forEach((k) => {
      dealsByMonth[k] = [];
    });

    data.forEach((deal) => {
      // Won deals: group by trial_start_date if available, else expected_closing_date
      const isWon = deal.stage === "closed-won";
      const dateStr =
        isWon && deal.trial_start_date
          ? deal.trial_start_date
          : deal.expected_closing_date;

      if (!dateStr) return;
      const monthKey = startOfMonth(parseISO(dateStr)).toISOString();
      if (!dealsByMonth[monthKey]) return; // outside range
      dealsByMonth[monthKey].push(deal);
    });

    return monthKeys.map((month) => {
      const deals = dealsByMonth[month];
      return {
        date: format(parseISO(month), "MMM yy"),
        won: deals
          .filter((d) => d.stage === "closed-won")
          .reduce((acc, d) => acc + d.amount, 0),
        pending: deals
          .filter((d) =>
            ["lead", "qualified", "follow-up", "trial"].includes(d.stage),
          )
          .reduce((acc, d) => {
            // @ts-expect-error - multiplier type issue
            return acc + d.amount * multiplier[d.stage];
          }, 0),
        lost: deals
          .filter((d) =>
            ["perdu", "trial-failed", "declined"].includes(d.stage),
          )
          .reduce((acc, d) => acc - d.amount, 0),
      };
    });
  }, [data]);

  if (isPending) return null;

  const range = months.reduce(
    (acc, month) => {
      acc.min = Math.min(acc.min, month.lost);
      acc.max = Math.max(acc.max, month.won + month.pending);
      return acc;
    },
    { min: 0, max: 0 },
  );

  return (
    <Card className="p-5 shadow-sm border-border/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted/60">
            <span className="text-muted-foreground font-semibold text-base">
              €
            </span>
          </div>
          <h2 className="text-base font-semibold text-foreground">
            Revenus prévisionnels
          </h2>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--nosho-green)]" />
            Gagné
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--nosho-teal)]/50" />
            En cours
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--nosho-orange)]" />
            Perdu
          </span>
        </div>
      </div>
      <div className="h-[350px]">
        <ResponsiveBar
          data={months}
          indexBy="date"
          keys={["won", "pending", "lost"]}
          colors={["#92B592", "#4AA69680", "#FF9B54"]}
          margin={{ top: 20, right: 50, bottom: 30, left: 0 }}
          padding={0.35}
          borderRadius={4}
          valueScale={{
            type: "linear",
            min: range.min < 0 ? range.min * 1.2 : -1000,
            max: range.max > 0 ? range.max * 1.2 : 1000,
          }}
          indexScale={{ type: "band", round: true }}
          enableGridX={true}
          enableGridY={false}
          enableLabel={false}
          tooltip={({ value, indexValue }) => (
            <div className="p-2 bg-secondary rounded shadow inline-flex items-center gap-1 text-secondary-foreground">
              <strong>{indexValue}: </strong>&nbsp;{value > 0 ? "+" : ""}
              {value.toLocaleString(acceptedLanguages.at(0) ?? DEFAULT_LOCALE, {
                style: "currency",
                currency: CURRENCY,
              })}
            </div>
          )}
          axisTop={{
            tickSize: 0,
            tickPadding: 12,
            style: {
              ticks: {
                text: {
                  fill: "var(--color-muted-foreground)",
                },
              },
              legend: {
                text: {
                  fill: "var(--color-muted-foreground)",
                },
              },
            },
          }}
          axisBottom={{
            legendPosition: "middle",
            legendOffset: 50,
            tickSize: 0,
            tickPadding: 12,
            style: {
              ticks: {
                text: {
                  fill: "var(--color-muted-foreground)",
                },
              },
              legend: {
                text: {
                  fill: "var(--color-muted-foreground)",
                },
              },
            },
          }}
          axisLeft={null}
          axisRight={{
            format: (v: any) => `${Math.abs(v / 1000)}k`,
            tickValues: 8,
            style: {
              ticks: {
                text: {
                  fill: "var(--color-muted-foreground)",
                },
              },
              legend: {
                text: {
                  fill: "var(--color-muted-foreground)",
                },
              },
            },
          }}
          markers={
            [
              {
                axis: "y",
                value: 0,
                lineStyle: {
                  stroke: "var(--color-border)",
                  strokeWidth: 1,
                },
                textStyle: { fill: "var(--nosho-green)" },
                legend: "Gagné",
                legendPosition: "top-left",
                legendOrientation: "vertical",
              },
              {
                axis: "y",
                value: 0,
                lineStyle: { strokeOpacity: 0 },
                textStyle: { fill: "var(--nosho-orange)" },
                legend: "Perdu",
                legendPosition: "bottom-left",
                legendOrientation: "vertical",
              },
            ] as any
          }
        />
      </div>
    </Card>
  );
});
