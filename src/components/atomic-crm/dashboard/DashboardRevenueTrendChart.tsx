import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  formatCompactCurrency,
  type AnnualQualityFlag,
  type DashboardMeta,
  type RevenueTrendPoint,
} from "./dashboardModel";

export const DashboardRevenueTrendChart = ({
  data,
  meta,
  qualityFlags,
  year: _year,
  isCurrentYear,
}: {
  data: RevenueTrendPoint[];
  meta: DashboardMeta;
  qualityFlags: AnnualQualityFlag[];
  year: number;
  isCurrentYear: boolean;
}) => (
  <Card className="gap-0">
    <CardHeader className="px-4 pb-3">
      <CardTitle className="text-base">
        Andamento del lavoro nell'anno
      </CardTitle>
      <p className="text-xs text-muted-foreground">
        {isCurrentYear
          ? `${meta.operationsPeriodLabel} · netto sconti, finora`
          : `${meta.operationsPeriodLabel} · netto sconti`}
      </p>
      {qualityFlags.includes("future_services_excluded") ? (
        <p className="text-xs text-muted-foreground">
          I servizi futuri oltre il {meta.asOfDateLabel} sono esclusi.
        </p>
      ) : null}
    </CardHeader>
    <CardContent className="px-2 pb-2">
      {data.every((item) => item.revenue === 0) ? (
        <EmptyChartMessage message="Nessun dato di fatturato disponibile" />
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart
            data={data}
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
            <Tooltip content={<RevenueTooltip />} />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#0ea5e9"
              strokeWidth={3}
              dot={{ r: 3, fill: "#0ea5e9" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </CardContent>
  </Card>
);

const RevenueTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: RevenueTrendPoint }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium">
        {formatCompactCurrency(point.revenue)}
      </p>
      <p className="text-xs text-muted-foreground">
        Rimborso km: {formatCompactCurrency(point.kmCost)}
      </p>
    </div>
  );
};

const EmptyChartMessage = ({ message }: { message: string }) => (
  <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
    {message}
  </div>
);
