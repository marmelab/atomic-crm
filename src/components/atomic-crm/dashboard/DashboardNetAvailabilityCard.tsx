import { BadgeDollarSign } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  formatCurrency,
  formatCurrencyPrecise,
  type DashboardKpis,
  type DashboardMeta,
} from "./dashboardModel";
import type { FiscalKpis } from "./fiscalModel";

export const DashboardNetAvailabilityCard = ({
  kpis,
  fiscalKpis,
  meta,
  taxesPaid = 0,
}: {
  kpis: DashboardKpis;
  fiscalKpis: FiscalKpis | null;
  meta: DashboardMeta;
  taxesPaid?: number;
}) => {
  const cashReceived = kpis.cashReceivedNet;
  const expenses = kpis.annualExpensesTotal;
  const { ownExpenses, clientExpenses } = kpis;
  const taxEstimate = fiscalKpis
    ? fiscalKpis.stimaInpsAnnuale + fiscalKpis.stimaImpostaAnnuale
    : 0;
  const taxRemaining = Math.max(0, taxEstimate - taxesPaid);

  const netAvailability = cashReceived - expenses - taxRemaining;
  const hasFiscalData = fiscalKpis != null;
  const isPositive = netAvailability >= 0;

  return (
    <Card
      className={`gap-3 py-4 border-l-4 ${isPositive ? "border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-l-red-500 bg-red-50/50 dark:bg-red-950/20"}`}
    >
      <CardHeader className="px-4 pb-0 flex flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-sm font-medium">
          Disponibilit&agrave; netta stimata
        </CardTitle>
        <BadgeDollarSign
          className={`h-4 w-4 ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
        />
      </CardHeader>
      <CardContent className="px-4 space-y-3">
        <div
          className={`text-2xl font-bold tracking-tight ${isPositive ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}
        >
          {formatCurrency(netAvailability)}
        </div>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none list-none flex items-center gap-1 text-muted-foreground/70 hover:text-muted-foreground">
            <span className="text-[10px]">&#9654;</span> Dettaglio calcolo
          </summary>
          <div className="divide-y mt-1">
            <p className="py-1">
              Incassato netto: {formatCurrencyPrecise(cashReceived)}
            </p>
            <p className="py-1">
              Spese proprie: &minus;{formatCurrencyPrecise(ownExpenses)}
            </p>
            {clientExpenses > 0 && (
              <p className="py-1 text-amber-600 dark:text-amber-400">
                Spese su lavori: &minus;
                {formatCurrencyPrecise(clientExpenses)}
                <span className="text-muted-foreground">
                  {" "}
                  (rimborsate dal cliente)
                </span>
              </p>
            )}
            {hasFiscalData ? (
              <p className="py-1">
                Tasse stimate: &minus;{formatCurrencyPrecise(taxEstimate)}
                {taxesPaid > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {" "}
                    (versato {formatCurrencyPrecise(taxesPaid)}, resta{" "}
                    {formatCurrencyPrecise(taxRemaining)})
                  </span>
                )}
              </p>
            ) : (
              <p className="py-1 text-amber-600 dark:text-amber-400">
                Tasse escluse (configura Fiscale in Impostazioni)
              </p>
            )}
            <p className="py-1 font-semibold text-foreground">
              Disponibilit&agrave; netta:{" "}
              {formatCurrencyPrecise(netAvailability)}
            </p>
          </div>
        </details>
        <Badge variant="outline" className="text-[10px] bg-white dark:bg-background">
          {meta.isCurrentYear ? "Provvisorio" : meta.selectedYear.toString()}{" "}
          &middot; cassa &minus; spese &minus; tasse
        </Badge>
      </CardContent>
    </Card>
  );
};
