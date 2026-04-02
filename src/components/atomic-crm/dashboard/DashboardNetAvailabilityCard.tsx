import { Banknote, Receipt, Landmark } from "lucide-react";
import { Link } from "react-router-dom";

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
  totalOpenObligations,
}: {
  kpis: DashboardKpis;
  fiscalKpis: FiscalKpis | null;
  meta: DashboardMeta;
  totalOpenObligations?: number;
}) => {
  const cashReceived = kpis.cashReceivedNet;
  const expenses = kpis.ownExpenses;
  const hasFiscalData = fiscalKpis != null;
  const taxReserve =
    totalOpenObligations != null
      ? totalOpenObligations
      : hasFiscalData
        ? fiscalKpis.stimaInpsAnnuale + fiscalKpis.stimaImpostaAnnuale
        : 0;

  const netAvailability = cashReceived - expenses - taxReserve;
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
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-0 items-start">
          {/* Incassato */}
          <div className="pr-2 sm:pr-3 space-y-1 text-center min-w-0">
            <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Banknote className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide">
                Incassato
              </span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
              {formatCurrencyPrecise(cashReceived)}
            </div>
          </div>

          <Separator orientation="vertical" className="self-stretch" />

          {/* Spese */}
          <div className="px-2 sm:px-3 space-y-1 text-center min-w-0">
            <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
              <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide">
                Spese
              </span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-red-700 dark:text-red-300 tabular-nums">
              {formatCurrencyPrecise(expenses)}
            </div>
          </div>

          <Separator orientation="vertical" className="self-stretch" />

          {/* Tasse */}
          <div className="pl-2 sm:pl-3 space-y-1 text-center min-w-0">
            <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
              <Landmark className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide">
                Riserva tasse
              </span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-red-700 dark:text-red-300 tabular-nums">
              {hasFiscalData ? formatCurrencyPrecise(taxReserve) : "—"}
            </div>
            {!hasFiscalData && (
              <Link
                to="/settings"
                className="text-[11px] text-amber-600 dark:text-amber-400 underline underline-offset-2"
              >
                Configura Fiscale
              </Link>
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
        {hasFiscalData && (
          <p className="text-[11px] text-center text-muted-foreground">
            Indicatore prudenziale: sottrae spese e riserva fiscale stimata
            dell&apos;anno selezionato.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
