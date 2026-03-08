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

  return (
    <Card className="gap-3 py-4 border-primary/20 bg-primary/[0.02]">
      <CardHeader className="px-4 pb-0 flex flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-sm font-medium">
          Disponibilit&agrave; netta stimata
        </CardTitle>
        <BadgeDollarSign className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent className="px-4 space-y-2">
        <div className="text-2xl font-bold tracking-tight">
          {formatCurrency(netAvailability)}
        </div>
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p>Incassato netto: {formatCurrencyPrecise(cashReceived)}</p>
          <p>
            Spese proprie: &minus;{formatCurrencyPrecise(ownExpenses)}
          </p>
          {clientExpenses > 0 && (
            <p className="text-amber-600 dark:text-amber-400">
              Spese su lavori: &minus;
              {formatCurrencyPrecise(clientExpenses)}
              <span className="text-muted-foreground">
                {" "}
                (rimborsate dal cliente)
              </span>
            </p>
          )}
          {hasFiscalData ? (
            <>
              <p>
                Tasse stimate: &minus;{formatCurrencyPrecise(taxEstimate)}
                {taxesPaid > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {" "}
                    (versato {formatCurrencyPrecise(taxesPaid)}, resta{" "}
                    {formatCurrencyPrecise(taxRemaining)})
                  </span>
                )}
              </p>
            </>
          ) : (
            <p className="text-amber-600 dark:text-amber-400">
              Tasse escluse (configura Fiscale in Impostazioni)
            </p>
          )}
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {meta.isCurrentYear ? "Provvisorio" : meta.selectedYear.toString()}{" "}
          &middot; cassa &minus; spese &minus; tasse
        </Badge>
      </CardContent>
    </Card>
  );
};
