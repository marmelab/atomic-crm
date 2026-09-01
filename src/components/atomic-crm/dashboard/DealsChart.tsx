import { ResponsiveBar } from "@nivo/bar";
import { format, startOfMonth } from "date-fns-jalali";
import { TrendingUp } from "lucide-react";
import { useGetList, useTranslate } from "ra-core";
import { memo, useMemo } from "react";

import { findDealLabel } from "../deals/dealUtils";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";

const multiplier = {
  opportunity: 0.2,
  "proposal-sent": 0.5,
  "in-negociation": 0.8,
  delayed: 0.3,
};

const threeMonthsAgo = new Date(
  new Date().setMonth(new Date().getMonth() - 6),
).toISOString();

export const DealsChart = memo(() => {
  const translate = useTranslate();
  const { dealStages } = useConfigurationContext(); 
  const wonLabel = findDealLabel(dealStages, "won") ?? "برنده";
  const lostLabel = findDealLabel(dealStages, "lost") ?? "باخته";

  const { data, isPending } = useGetList<Deal>("deals", {
    pagination: { perPage: 100, page: 1 },
    sort: {
      field: "created_at",
      order: "ASC",
    },
    filter: {
      "created_at@gte": threeMonthsAgo,
    },
  });

  const months = useMemo(() => {
    if (!data) return [];
    const dealsByMonth = data.reduce((acc, deal) => {
      const month = startOfMonth(deal.created_at ?? new Date()).toISOString();
      if (!acc[month]) {
        acc[month] = [];
      }
      acc[month].push(deal);
      return acc;
    }, {} as any);

    const amountByMonth = Object.keys(dealsByMonth).map((month) => {
      return {
        
        date: format(new Date(month), "MMM"),
        won: dealsByMonth[month]
          .filter((deal: Deal) => deal.stage === "won")
          .reduce((acc: number, deal: Deal) => {
            acc += deal.amount;
            return acc;
          }, 0),
        pending: dealsByMonth[month]
          .filter((deal: Deal) => !["won", "lost"].includes(deal.stage))
          .reduce((acc: number, deal: Deal) => {
            // @ts-expect-error - deal.stage may not exist in multiplier
            acc += deal.amount * multiplier[deal.stage];
            return acc;
          }, 0),
        lost: dealsByMonth[month]
          .filter((deal: Deal) => deal.stage === "lost")
          .reduce((acc: number, deal: Deal) => {
            acc -= deal.amount;
            return acc;
          }, 0),
      };
    });

    return amountByMonth;
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
      <div className="flex items-center mb-4 gap-3">
        <div className="flex">
          <TrendingUp className="text-muted-foreground w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-muted-foreground">
          {translate("crm.dashboard.deals_chart")}
        </h2>
      </div>
      
      {}
      <div className="h-[400px]" dir="ltr">
        <ResponsiveBar
          data={months}
          indexBy="date"
          keys={["won", "pending", "lost"]}
          colors={["#61cdbb", "#97e3d5", "#e25c3b"]}
          margin={{ top: 30, right: 60, bottom: 30, left: 10 }}
          padding={0.3}
          valueScale={{
            type: "linear",
            min: range.min * 1.2,
            max: range.max * 1.2,
          }}
          indexScale={{ type: "band", round: true }}
          enableGridX={true}
          enableGridY={false}
          enableLabel={false}
          tooltip={({ value, indexValue }) => (
            <div className="p-2 bg-secondary rounded shadow inline-flex items-center gap-1 text-secondary-foreground" dir="rtl">
              <strong>{indexValue}: </strong>&nbsp;
              <span dir="ltr">
                {value > 0 ? "+" : ""}
                {value ? `${Number(value).toLocaleString("fa-IR")}` : "۰"} تومان
              </span>
            </div>
          )}
          axisTop={{
            tickSize: 0,
            tickPadding: 12,
            style: {
              ticks: { text: { fill: "var(--color-muted-foreground)", fontFamily: "inherit" } },
              legend: { text: { fill: "var(--color-muted-foreground)" } },
            },
          }}
          axisBottom={{
            legendPosition: "middle",
            legendOffset: 50,
            tickSize: 0,
            tickPadding: 12,
            style: {
              ticks: { text: { fill: "var(--color-muted-foreground)", fontFamily: "inherit" } },
              legend: { text: { fill: "var(--color-muted-foreground)" } },
            },
          }}
          axisLeft={null}
          axisRight={{
            format: (v: any) => `${Number(Math.abs(v / 1000)).toLocaleString("fa-IR")}k`,
            tickValues: 8,
            style: {
              ticks: { text: { fill: "var(--color-muted-foreground)", fontFamily: "inherit" } },
              legend: { text: { fill: "var(--color-muted-foreground)" } },
            },
          }}
          markers={
            [
              {
                axis: "y",
                value: 0,
                lineStyle: { strokeOpacity: 0 },
                textStyle: { fill: "#2ebca6", fontFamily: "inherit" },
                legend: wonLabel,
                legendPosition: "top-left",
                legendOrientation: "vertical",
              },
              {
                axis: "y",
                value: 0,
                lineStyle: { stroke: "#f47560", strokeWidth: 1 },
                textStyle: { fill: "#e25c3b", fontFamily: "inherit" },
                legend: lostLabel,
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