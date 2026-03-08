import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  formatCurrencyPrecise,
  formatShortDate,
  type CashFlowForecast,
} from "./dashboardModel";

export const DashboardCashFlowCard = ({
  forecast,
}: {
  forecast: CashFlowForecast;
}) => {
  const isPositive = forecast.netFlow >= 0;

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="text-base font-semibold">
          Prossimi {forecast.horizonDays} giorni
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 space-y-3">
        {/* ── Two-column: Entrate vs Uscite ── */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-0">
          {/* LEFT — Entrate */}
          <div className="pr-2 sm:pr-3 space-y-1 min-w-0">
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <ArrowDownRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide">
                Entrano
              </span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
              {formatCurrencyPrecise(forecast.inflowsTotal)}
            </div>
            <FlowList
              items={forecast.inflows}
              emptyLabel="Nessun pagamento in arrivo"
            />
          </div>

          {/* CENTER — Separator */}
          <Separator orientation="vertical" className="mx-0" />

          {/* RIGHT — Uscite */}
          <div className="pl-2 sm:pl-3 space-y-1 min-w-0">
            <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide">
                Escono
              </span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-red-700 dark:text-red-300 tabular-nums">
              {formatCurrencyPrecise(forecast.outflowsTotal)}
            </div>
            <FlowList
              items={forecast.outflows}
              emptyLabel="Nessuna scadenza"
            />
          </div>
        </div>

        {/* ── Net result ── */}
        <div
          className={`flex items-center justify-center gap-2 rounded-md py-2 text-sm font-bold ${
            isPositive
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
              : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
          }`}
        >
          <Minus className="h-3.5 w-3.5" />
          <span>
            {isPositive ? "Restano " : "Mancano "}
            {formatCurrencyPrecise(Math.abs(forecast.netFlow))}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

const FlowList = ({
  items,
  emptyLabel,
}: {
  items: CashFlowForecast["inflows"];
  emptyLabel: string;
}) => {
  if (items.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground/70 italic">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {items.slice(0, 4).map((item, i) => (
        <li
          key={`${item.date}-${i}`}
          className="text-[11px] text-muted-foreground leading-tight"
        >
          <span className="tabular-nums font-medium text-foreground/80">
            {formatCurrencyPrecise(item.amount)}
          </span>{" "}
          <span className="text-muted-foreground/60">
            {item.label} · {formatShortDate(item.date)}
          </span>
        </li>
      ))}
      {items.length > 4 && (
        <li className="text-[11px] text-muted-foreground/50">
          +{items.length - 4} altri
        </li>
      )}
    </ul>
  );
};
