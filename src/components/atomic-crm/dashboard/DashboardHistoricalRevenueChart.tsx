import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { formatCompactCurrency, formatCurrency } from "./dashboardModel";
import type {
  DashboardHistoryModel,
  HistoricalRevenuePoint,
} from "./dashboardHistoryModel";

export const DashboardHistoricalRevenueChart = ({
  model,
}: {
  model: DashboardHistoryModel;
}) => (
  <Card className="gap-0">
    <CardHeader className="px-4 pb-3">
      <CardTitle className="text-base">Andamento anno per anno</CardTitle>
      <p className="text-xs text-muted-foreground">
        Quanto vale il lavoro anno per anno dal{" "}
        {model.meta.firstYearWithData ?? model.meta.currentYear} al{" "}
        {model.meta.currentYear}. Il {model.meta.currentYear} si ferma al{" "}
        {model.meta.asOfDateLabel}, quindi non è un anno completo.
      </p>
    </CardHeader>
    <CardContent className="px-2 pb-2">
      {model.yearlyRevenue.length === 0 ||
      model.yearlyRevenue.every((item) => item.revenue === 0) ? (
        <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
          Nessun dato storico disponibile
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={model.yearlyRevenue}
            margin={{ top: 10, right: 12, left: 4, bottom: 4 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              strokeOpacity={0.18}
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              fontSize={12}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={64}
              fontSize={12}
              tickFormatter={(value) => formatCompactCurrency(value as number)}
            />
            <Tooltip content={<HistoricalRevenueTooltip />} />
            <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
              {model.yearlyRevenue.map((item) => (
                <Cell
                  key={item.year}
                  fill={item.isYtd ? "#f59e0b" : "#0ea5e9"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </CardContent>
  </Card>
);

const HistoricalRevenueTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: HistoricalRevenuePoint }>;
}) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
      <p className="text-xs text-muted-foreground mb-1">
        {point.isYtd ? `${point.year} (fino a oggi)` : point.year}
      </p>
      <p className="text-sm font-medium">{formatCurrency(point.revenue)}</p>
      <p className="text-xs text-muted-foreground">
        Rimborso km: {formatCompactCurrency(point.kmCost)}
      </p>
    </div>
  );
};
