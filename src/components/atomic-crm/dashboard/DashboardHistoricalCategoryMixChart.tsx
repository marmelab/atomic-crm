import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { formatCompactCurrency } from "./dashboardModel";
import type {
  DashboardHistoryModel,
  HistoricalCategoryMixPoint,
} from "./dashboardHistoryModel";

const colors = ["#0ea5e9", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6"];

export const DashboardHistoricalCategoryMixChart = ({
  model,
  isPending,
  hasError,
}: {
  model: DashboardHistoryModel;
  isPending: boolean;
  hasError: boolean;
}) => {
  if (hasError) {
    return (
      <Card className="gap-0">
        <CardHeader className="px-4 pb-3">
          <CardTitle className="text-base">
            Da dove arrivano i guadagni
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-10 text-center text-sm text-muted-foreground">
          Impossibile caricare il mix categorie.
        </CardContent>
      </Card>
    );
  }

  if (isPending && model.categoryMix.points.length === 0) {
    return (
      <Card className="gap-0">
        <CardHeader className="px-4 pb-3">
          <CardTitle className="text-base">
            Da dove arrivano i guadagni
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-10 text-center text-sm text-muted-foreground">
          Caricamento mix categorie...
        </CardContent>
      </Card>
    );
  }

  const chartData = model.categoryMix.points.map((point) => ({
    label: point.label,
    isYtd: point.isYtd,
    ...point.values,
  }));

  return (
    <Card className="gap-0">
      <CardHeader className="px-4 pb-3">
        <CardTitle className="text-base">Da dove arrivano i guadagni</CardTitle>
        <p className="text-xs text-muted-foreground">
          Qui vedi quali tipi di lavoro pesano di più ogni anno. Il{" "}
          {model.meta.currentYear} si ferma al {model.meta.asOfDateLabel},
          quindi non è un anno completo.
        </p>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        {model.categoryMix.series.length === 0 ||
        model.categoryMix.points.every((point) =>
          Object.values(point.values).every((value) => value === 0),
        ) ? (
          <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
            Nessun dato storico per categoria
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={chartData}
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
                tickFormatter={(value) =>
                  formatCompactCurrency(value as number)
                }
              />
              <Tooltip content={<HistoricalCategoryMixTooltip />} />
              <Legend />
              {model.categoryMix.series.map((series, index) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  name={series.label}
                  stackId="categories"
                  fill={colors[index % colors.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

interface RechartsPayloadEntry {
  dataKey: string;
  name: string;
  value: number;
  payload: HistoricalCategoryMixPoint & Record<string, number>;
}

const HistoricalCategoryMixTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: RechartsPayloadEntry[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;

  const rows = payload
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-sm min-w-[220px]">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <div className="space-y-1.5">
        {rows.map((item) => (
          <div
            key={item.dataKey}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span>{item.name}</span>
            <span className="font-medium">
              {formatCompactCurrency(item.value as number)}
            </span>
          </div>
        ))}
      </div>
      {"isYtd" in point && point.isYtd ? (
        <p className="text-[11px] text-muted-foreground mt-2">
          Anno in corso, solo fino a oggi
        </p>
      ) : null}
    </div>
  );
};
