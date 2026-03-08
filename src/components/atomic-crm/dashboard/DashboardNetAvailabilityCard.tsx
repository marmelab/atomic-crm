import { Banknote, Receipt, Landmark } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
  meta: _meta,
  taxesPaid = 0,
}: {
  kpis: DashboardKpis;
  fiscalKpis: FiscalKpis | null;
  meta: DashboardMeta;
  taxesPaid?: number;
}) => {
  const cashReceived = kpis.cashReceivedNet;
  const expenses = kpis.ownExpenses;
  const hasFiscalData = fiscalKpis != null;
  const taxEstimate = hasFiscalData
    ? fiscalKpis.stimaInpsAnnuale + fiscalKpis.stimaImpostaAnnuale
    : 0;
  const taxRemaining = Math.max(0, taxEstimate - taxesPaid);

  const netAvailability = cashReceived - expenses - taxRemaining;
  const isPositive = netAvailability >= 0;

  return (
    <Card className="gap-3 py-4 col-span-1 sm:col-span-2 xl:col-span-5">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="text-base font-semibold">
          Quanto ti resta in tasca
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 space-y-3">
        {/* ── Three-column breakdown ── */}
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-0">
          {/* Incassato */}
          <div className="pr-3 space-y-1 text-center">
            <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Banknote className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Incassato
              </span>
            </div>
            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
              {formatCurrencyPrecise(cashReceived)}
            </div>
          </div>

          <Separator orientation="vertical" />

          {/* Spese */}
          <div className="px-3 space-y-1 text-center">
            <div className="flex items-center justify-center gap-1.5 text-red-600 dark:text-red-400">
              <Receipt className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Spese
              </span>
            </div>
            <div className="text-xl font-bold text-red-700 dark:text-red-300 tabular-nums">
              {formatCurrencyPrecise(expenses)}
            </div>
          </div>

          <Separator orientation="vertical" />

          {/* Tasse */}
          <div className="pl-3 space-y-1 text-center">
            <div className="flex items-center justify-center gap-1.5 text-red-600 dark:text-red-400">
              <Landmark className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Tasse
              </span>
            </div>
            <div className="text-xl font-bold text-red-700 dark:text-red-300 tabular-nums">
              {hasFiscalData ? formatCurrencyPrecise(taxRemaining) : "—"}
            </div>
            {hasFiscalData && taxesPaid > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Già versato {formatCurrencyPrecise(taxesPaid)}
              </p>
            )}
            {!hasFiscalData && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Configura Fiscale
              </p>
            )}
          </div>
        </div>

        {kpis.clientExpenses > 0 && (
          <p className="text-[11px] text-center text-muted-foreground">
            + {formatCurrencyPrecise(kpis.clientExpenses)} spese su lavori
            (rimborsate dal cliente, escluse dal calcolo)
          </p>
        )}

        {/* ── Net result ── */}
        <div
          className={`flex items-center justify-center gap-2 rounded-md py-2 text-sm font-bold ${
            isPositive
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
              : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
          }`}
        >
          {isPositive ? "Ti restano " : "Ti mancano "}
          {formatCurrency(Math.abs(netAvailability))}
        </div>
      </CardContent>
    </Card>
  );
};
