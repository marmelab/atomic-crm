import { ResponsiveLine } from "@nivo/line";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import type {
  CustomerPortfolioTrendPoint,
  CustomerPortfolioViewModel,
} from "../types";
import { formatPeriod } from "./portfolioModel";

type TrendMetric =
  | "clicks"
  | "impressions"
  | "ctr"
  | "position"
  | "performance"
  | "gbpActions";

const METRICS: Array<{ value: TrendMetric; label: string }> = [
  { value: "clicks", label: "Klick" },
  { value: "impressions", label: "Visningar" },
  { value: "ctr", label: "CTR" },
  { value: "position", label: "Position" },
  { value: "performance", label: "Prestanda" },
  { value: "gbpActions", label: "Business" },
];

function metricValue(
  point: CustomerPortfolioTrendPoint,
  metric: TrendMetric,
): number | null {
  const value = point[metric];
  if (value == null) return null;
  return metric === "ctr" ? value * 100 : value;
}

export function CustomerPortfolioTrendChart({
  model,
}: {
  model: CustomerPortfolioViewModel;
}) {
  const [metric, setMetric] = useState<TrendMetric>("clicks");
  const points = model.trends.flatMap((point) => {
    const value = metricValue(point, metric);
    return value == null
      ? []
      : [
          {
            x: point.period,
            y: value,
            customers: point.customers,
          },
        ];
  });

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Portföljens utveckling</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Varje punkt visar hur många kundwebbplatser som ingår.
            </p>
          </div>
          <ToggleGroup
            type="single"
            value={metric}
            onValueChange={(value) => {
              if (value) setMetric(value as TrendMetric);
            }}
            className="flex flex-wrap justify-start"
          >
            {METRICS.map((item) => (
              <ToggleGroupItem
                key={item.value}
                value={item.value}
                size="sm"
                aria-label={`Visa ${item.label.toLowerCase()}`}
              >
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        {points.length < 2 ? (
          <div className="flex h-72 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            Minst två mätmånader behövs för en portföljtrend.
          </div>
        ) : (
          <div className="h-72" aria-label="Portföljtrend">
            <ResponsiveLine
              data={[{ id: metric, data: points }]}
              margin={{ top: 16, right: 24, bottom: 52, left: 58 }}
              xScale={{ type: "point" }}
              yScale={{
                type: "linear",
                min: "auto",
                max: "auto",
                reverse: metric === "position",
              }}
              curve="monotoneX"
              colors={["hsl(var(--primary))"]}
              lineWidth={3}
              pointSize={8}
              pointBorderWidth={2}
              pointBorderColor={{ from: "serieColor" }}
              pointColor={{ theme: "background" }}
              enableArea
              areaOpacity={0.08}
              enableGridX={false}
              axisBottom={{
                tickRotation: -20,
                format: (value) => formatPeriod(String(value)).replace(" ", " "),
              }}
              axisLeft={{
                format: (value) =>
                  metric === "ctr" ? `${Number(value).toFixed(0)} %` : value,
              }}
              useMesh
              tooltip={({ point }) => (
                <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
                  <p className="font-medium">
                    {formatPeriod(String(point.data.x))}
                  </p>
                  <p>
                    {Number(point.data.yFormatted).toLocaleString("sv-SE")}
                    {metric === "ctr" ? " %" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {Number(point.data.customers)} kunder med data
                  </p>
                </div>
              )}
              theme={{
                text: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
                grid: { line: { stroke: "hsl(var(--border))" } },
                axis: {
                  domain: { line: { stroke: "hsl(var(--border))" } },
                  ticks: {
                    line: { stroke: "hsl(var(--border))" },
                    text: { fill: "hsl(var(--muted-foreground))" },
                  },
                },
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
