import { ArrowDownRight, ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <Card
      className={`gap-3 py-4 border-l-4 ${isPositive ? "border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-l-red-500 bg-red-50/50 dark:bg-red-950/20"}`}
    >
      <CardHeader className="px-4 pb-0 flex flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-sm font-medium">
          Cash flow prossimi {forecast.horizonDays} giorni
        </CardTitle>
        {isPositive ? (
          <TrendingUp
            className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
          />
        ) : (
          <TrendingDown
            className="h-4 w-4 text-red-600 dark:text-red-400"
          />
        )}
      </CardHeader>
      <CardContent className="px-4 space-y-3">
        <div
          className={`text-2xl font-bold tracking-tight ${
            isPositive
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-red-700 dark:text-red-300"
          }`}
        >
          {isPositive ? "+" : ""}
          {formatCurrencyPrecise(forecast.netFlow)}
        </div>

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none list-none flex items-center gap-1 text-muted-foreground/70 hover:text-muted-foreground">
            <span className="text-[10px]">&#9654;</span> Dettaglio flussi
          </summary>
          <div className="divide-y mt-1">
            <div className="py-1 space-y-0.5">
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center gap-1.5">
                  <ArrowDownRight className="h-3.5 w-3.5 text-emerald-600" />
                  Entrate attese
                </span>
                <span>{formatCurrencyPrecise(forecast.inflowsTotal)}</span>
              </div>
              {forecast.inflows.length === 0 ? (
                <p className="text-[11px] pl-5">Nessun pagamento in arrivo</p>
              ) : (
                <ul className="space-y-0.5 pl-5">
                  {forecast.inflows.slice(0, 5).map((item, i) => (
                    <li
                      key={`in-${item.date}-${i}`}
                      className="flex items-center justify-between text-[11px]"
                    >
                      <span className="truncate mr-2">
                        {item.label}
                        <span className="text-muted-foreground/60 ml-1">
                          ({formatShortDate(item.date)})
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatCurrencyPrecise(item.amount)}
                      </span>
                    </li>
                  ))}
                  {forecast.inflows.length > 5 && (
                    <li className="text-[11px]">
                      +{forecast.inflows.length - 5} altri
                    </li>
                  )}
                </ul>
              )}
            </div>
            <div className="py-1 space-y-0.5">
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center gap-1.5">
                  <ArrowUpRight className="h-3.5 w-3.5 text-red-600" />
                  Uscite previste
                </span>
                <span>{formatCurrencyPrecise(forecast.outflowsTotal)}</span>
              </div>
              {forecast.outflows.length === 0 ? (
                <p className="text-[11px] pl-5">
                  Nessuna scadenza nei prossimi 30 giorni
                </p>
              ) : (
                <ul className="space-y-0.5 pl-5">
                  {forecast.outflows.slice(0, 5).map((item, i) => (
                    <li
                      key={`out-${item.date}-${i}`}
                      className="flex items-center justify-between text-[11px]"
                    >
                      <span className="truncate mr-2">
                        {item.label}
                        <span className="text-muted-foreground/60 ml-1">
                          ({formatShortDate(item.date)})
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatCurrencyPrecise(item.amount)}
                      </span>
                    </li>
                  ))}
                  {forecast.outflows.length > 5 && (
                    <li className="text-[11px]">
                      +{forecast.outflows.length - 5} altri
                    </li>
                  )}
                </ul>
              )}
            </div>
            <p className="py-1 font-semibold text-foreground">
              Flusso netto:{" "}
              {isPositive ? "+" : ""}
              {formatCurrencyPrecise(forecast.netFlow)}
            </p>
          </div>
        </details>

        <Badge
          variant={isPositive ? "outline" : "destructive"}
          className={`text-[10px] ${isPositive ? "bg-white dark:bg-background" : ""}`}
        >
          {isPositive
            ? "Previsione · entrate − uscite 30gg"
            : "Uscite superiori alle entrate attese"}
        </Badge>
      </CardContent>
    </Card>
  );
};
