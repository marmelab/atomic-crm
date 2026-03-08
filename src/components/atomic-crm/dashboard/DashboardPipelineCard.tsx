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
import { Separator } from "@/components/ui/separator";

import {
  formatCompactCurrency,
  type QuotePipelinePoint,
} from "./dashboardModel";

const positiveStatuses = new Set([
  "accettato",
  "acconto_ricevuto",
  "in_lavorazione",
  "completato",
  "saldato",
]);
const negativeStatuses = new Set(["rifiutato", "perso"]);

export const DashboardPipelineCard = ({
  data,
}: {
  data: QuotePipelinePoint[];
}) => {
  const chartData = data.filter((item) => item.count > 0);
  const totalCount = data.reduce((sum, d) => sum + d.count, 0);
  const totalAmount = data.reduce((sum, d) => sum + d.amount, 0);

  return (
    <Card className="gap-0">
      <CardHeader className="px-4 pb-3">
        <CardTitle className="text-base font-semibold">
          Pipeline preventivi
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-2 space-y-3">
        {/* Summary counters */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-0">
          <div className="text-center">
            <div className="text-xl font-bold text-sky-700 dark:text-sky-300">
              {totalCount}
            </div>
            <p className="text-[11px] text-muted-foreground">preventivi</p>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div className="text-center">
            <div className="text-xl font-bold text-sky-700 dark:text-sky-300 tabular-nums">
              {formatCompactCurrency(totalAmount)}
            </div>
            <p className="text-[11px] text-muted-foreground">valore totale</p>
          </div>
        </div>
        {!chartData.length ? (
          <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
            Nessun preventivo disponibile
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
              barCategoryGap={8}
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
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={132}
                tickLine={false}
                axisLine={false}
                fontSize={11}
              />
              <Tooltip
                content={<PipelineTooltip />}
                cursor={{ fill: "rgba(148,163,184,0.12)" }}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {chartData.map((item) => (
                  <Cell
                    key={item.status}
                    fill={getPipelineColor(item.status)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

const PipelineTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: QuotePipelinePoint }>;
}) => {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
      <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
      <p className="text-sm font-medium">{item.count} preventivi</p>
      <p className="text-xs text-muted-foreground">
        Valore: {formatCompactCurrency(item.amount)}
      </p>
    </div>
  );
};

const getPipelineColor = (status: string) => {
  if (negativeStatuses.has(status)) return "#ef4444";
  if (positiveStatuses.has(status)) return "#14b8a6";
  return "#0ea5e9";
};
