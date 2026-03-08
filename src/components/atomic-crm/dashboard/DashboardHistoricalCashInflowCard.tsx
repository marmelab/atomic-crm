import { useQuery } from "@tanstack/react-query";
import { Banknote } from "lucide-react";

import type { CrmDataProvider } from "../providers/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useDataProvider } from "ra-core";

const formatCurrency = (value: number) =>
  value.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

export const DashboardHistoricalCashInflowCard = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ["historical-cash-inflow-context"],
    queryFn: () => dataProvider.getHistoricalCashInflowContext(),
  });

  if (error) {
    return (
      <Card className="gap-0">
        <CardHeader className="px-4 pb-3">
          <CardTitle className="text-base">Incassi ricevuti</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Impossibile caricare gli incassi storici.
          </p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Riprova
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isPending || !data) {
    return (
      <Card className="gap-0">
        <CardHeader className="px-4 pb-3">
          <CardTitle className="text-base">Incassi ricevuti</CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-10 text-center text-sm text-muted-foreground">
          Caricamento...
        </CardContent>
      </Card>
    );
  }

  if (data.series.yearlyCashInflow.length === 0) {
    return (
      <Card className="gap-0">
        <CardHeader className="px-4 pb-3">
          <CardTitle className="text-base">Incassi ricevuti</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-sm text-muted-foreground">
            Nessun incasso storico registrato.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalMetric = data.metrics.find(
    (metric) => metric.id === "historical_total_cash_inflow",
  );
  const latestClosedMetric = data.metrics.find(
    (metric) => metric.id === "latest_closed_year_cash_inflow",
  );
  const visibleRows = [...data.series.yearlyCashInflow].slice(-3).reverse();
  const maxCashInflow = Math.max(
    ...visibleRows.map((row) => row.cashInflow),
    0,
  );

  return (
    <Card className="gap-0">
      <CardHeader className="px-4 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Banknote className="h-4 w-4" />
          Incassi ricevuti
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {/* Two-column summary — Bambino style */}
        <div className="flex items-stretch gap-0">
          <div className="flex-1 text-center py-2">
            <p className="text-xs text-muted-foreground">Totale storico</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
              {totalMetric?.formattedValue ?? "N/D"}
            </p>
          </div>
          <Separator orientation="vertical" className="mx-2" />
          <div className="flex-1 text-center py-2">
            <p className="text-xs text-muted-foreground">
              {latestClosedMetric?.comparisonLabel ?? "Ultimo anno"}
            </p>
            <p className="text-xl sm:text-2xl font-bold text-amber-700 dark:text-amber-300 tabular-nums">
              {latestClosedMetric?.formattedValue ?? "N/D"}
            </p>
          </div>
        </div>

        <Separator />

        {/* Yearly bars */}
        <div className="space-y-3">
          {visibleRows.map((row) => (
            <div key={row.year} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">
                  {row.year}
                  {row.isYtd ? " finora" : ""}
                </span>
                <span className="font-semibold tabular-nums whitespace-nowrap">
                  {formatCurrency(row.cashInflow)}
                </span>
              </div>
              <Progress
                value={
                  maxCashInflow > 0 ? (row.cashInflow / maxCashInflow) * 100 : 0
                }
              />
              <p className="text-[11px] text-muted-foreground">
                {row.paymentsCount} pag. · {row.projectsCount} prog. ·{" "}
                {row.clientsCount} cl.
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
