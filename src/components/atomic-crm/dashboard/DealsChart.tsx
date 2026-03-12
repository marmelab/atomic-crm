import { ResponsiveBar } from "@nivo/bar";
import {
  addMonths,
  format,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { useGetList } from "ra-core";
import { memo, useMemo } from "react";

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
    },
  });

  const months = useMemo(() => {
    if (!data) return [];

    // Build a map of all months in the range (2 months ago → 10 months ahead)
    const now = new Date();
    const monthKeys: string[] = [];
    for (let i = -2; i <= 10; i++) {
      monthKeys.push(
        startOfMonth(addMonths(now, i)).toISOString(),
      );
    }

    const dealsByMonth: Record<string, Deal[]> = {};
    monthKeys.forEach((k) => {
      dealsByMonth[k] = [];
    });

    data.forEach((deal) => {
      // Won deals: group by trial_start_date if available, else expected_closing_date
      const isWon = deal.stage === "closed-won";
      const dateStr = isWon && deal.trial_start_date
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
    <div className="flex flex-col">
      <div className="flex items-center mb-4">
        <div className="mr-3 flex items-center justify-center w-6 h-6 text-muted-foreground font-semibold text-lg leading-none">
          €
        </div>
        <h2 className="text-xl font-semibold text-muted-foreground">
          Revenus prévisionnels
        </h2>
      </div>
      <div className="h-[400px]">
        <ResponsiveBar
          data={months}
          indexBy="date"
          keys={["won", "pending", "lost"]}
          colors={["#61cdbb", "#97e3d5", "#e25c3b"]}
          margin={{ top: 30, right: 50, bottom: 30, left: 0 }}
          padding={0.3}
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
                lineStyle: { strokeOpacity: 0 },
                textStyle: { fill: "#2ebca6" },
                legend: "Gagné",
                legendPosition: "top-left",
                legendOrientation: "vertical",
              },
              {
                axis: "y",
                value: 0,
                lineStyle: {
                  stroke: "#f47560",
                  strokeWidth: 1,
                },
                textStyle: { fill: "#e25c3b" },
                legend: "Perdu",
                legendPosition: "bottom-left",
                legendOrientation: "vertical",
              },
            ] as any
          }
        />
      </div>
    </div>
  );
});
