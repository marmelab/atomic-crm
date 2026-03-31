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

import { formatCurrency } from "./dashboardModel";
import type { AtecoBreakdownPoint } from "./fiscalModel";

export const DashboardAtecoChart = ({
  data,
  year,
}: {
  data: AtecoBreakdownPoint[];
  year: number;
}) => {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Incassato per ATECO</CardTitle>
          <p className="text-xs text-muted-foreground">Anno {year}</p>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground py-6 text-center">
          Nessun dato per l'anno {year}
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((point) => ({
    name: `${point.atecoCode} (${point.coefficiente}%)`,
    Incassato: Math.round(point.fatturato),
    "Reddito forfettario": Math.round(point.redditoForfettario),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Incassato per ATECO</CardTitle>
        <p className="text-xs text-muted-foreground">Anno {year}</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v: number) => formatCurrency(v)}
              fontSize={12}
            />
            <YAxis type="category" dataKey="name" width={120} fontSize={12} />
            <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
            <Legend />
            <Bar
              dataKey="Fatturato"
              fill="hsl(var(--chart-1))"
              radius={[0, 4, 4, 0]}
            />
            <Bar
              dataKey="Reddito forfettario"
              fill="hsl(var(--chart-2))"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
