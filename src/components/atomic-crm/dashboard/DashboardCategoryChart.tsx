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

import {
  type DashboardMeta,
  formatCompactCurrency,
  type CategoryBreakdownPoint,
} from "./dashboardModel";

const colors = ["#0ea5e9", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6"];

export const DashboardCategoryChart = ({
  data,
  meta,
  year: _year,
}: {
  data: CategoryBreakdownPoint[];
  meta: DashboardMeta;
  year: number;
}) => (
  <Card className="gap-0">
    <CardHeader className="px-4 pb-3">
      <CardTitle className="text-base">Categorie nell'anno</CardTitle>
      <p className="text-xs text-muted-foreground">
        {meta.operationsPeriodLabel} · valore del lavoro netto sconti
      </p>
    </CardHeader>
    <CardContent className="px-2 pb-2">
      {!data.length || data.every((item) => item.revenue === 0) ? (
        <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
          Nessun dato per categoria
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 20, left: 12, bottom: 8 }}
            barCategoryGap={12}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              strokeOpacity={0.12}
            />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              fontSize={12}
              tickFormatter={(value) => formatCompactCurrency(value as number)}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={120}
              tickLine={false}
              axisLine={false}
              fontSize={12}
            />
            <Tooltip
              content={<CategoryTooltip />}
              cursor={{ fill: "rgba(148,163,184,0.12)" }}
            />
            <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
              {data.map((item, index) => (
                <Cell
                  key={item.category}
                  fill={colors[index % colors.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </CardContent>
  </Card>
);

const CategoryTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CategoryBreakdownPoint }>;
}) => {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
      <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
      <p className="text-sm font-medium">
        {formatCompactCurrency(item.revenue)}
      </p>
    </div>
  );
};
