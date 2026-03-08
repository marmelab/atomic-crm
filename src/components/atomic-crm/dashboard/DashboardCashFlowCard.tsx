import { ArrowDownRight, ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { formatCurrencyPrecise, type CashFlowForecast } from "./dashboardModel";

export const DashboardCashFlowCard = ({
  forecast,
}: {
  forecast: CashFlowForecast;
}) => {
  const isPositive = forecast.netFlow >= 0;

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4 pb-0 flex flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-sm font-medium">
          Cash flow prossimi {forecast.horizonDays} giorni
        </CardTitle>
        {isPositive ? (
          <TrendingUp className="h-4 w-4 text-emerald-600" />
        ) : (
          <TrendingDown className="h-4 w-4 text-destructive" />
        )}
      </CardHeader>
      <CardContent className="px-4 space-y-3">
        <div
          className={`text-2xl font-semibold tracking-tight ${
            isPositive ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"
          }`}
        >
          {isPositive ? "+" : ""}
          {formatCurrencyPrecise(forecast.netFlow)}
        </div>

        <div className="space-y-2">
          <FlowSection
            title="Entrate attese"
            items={forecast.inflows}
            total={forecast.inflowsTotal}
            icon={<ArrowDownRight className="h-3.5 w-3.5 text-emerald-600" />}
            emptyLabel="Nessun pagamento in arrivo"
          />

          <Separator />

          <FlowSection
            title="Uscite previste"
            items={forecast.outflows}
            total={forecast.outflowsTotal}
            icon={<ArrowUpRight className="h-3.5 w-3.5 text-destructive" />}
            emptyLabel="Nessuna scadenza fiscale nei prossimi 30 giorni"
          />
        </div>

        {!isPositive && (
          <Badge variant="destructive" className="text-[10px]">
            Attenzione: uscite superiori alle entrate attese
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};

const FlowSection = ({
  title,
  items,
  total,
  icon,
  emptyLabel,
}: {
  title: string;
  items: CashFlowForecast["inflows"];
  total: number;
  icon: React.ReactNode;
  emptyLabel: string;
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between text-xs font-medium">
      <span className="flex items-center gap-1.5">
        {icon}
        {title}
      </span>
      <span>{formatCurrencyPrecise(total)}</span>
    </div>
    {items.length === 0 ? (
      <p className="text-[11px] text-muted-foreground pl-5">{emptyLabel}</p>
    ) : (
      <ul className="space-y-0.5 pl-5">
        {items.slice(0, 5).map((item, i) => (
          <li
            key={`${item.date}-${i}`}
            className="flex items-center justify-between text-[11px] text-muted-foreground"
          >
            <span className="truncate mr-2">{item.label}</span>
            <span className="shrink-0 tabular-nums">
              {formatCurrencyPrecise(item.amount)}
            </span>
          </li>
        ))}
        {items.length > 5 && (
          <li className="text-[11px] text-muted-foreground">
            +{items.length - 5} altri
          </li>
        )}
      </ul>
    )}
  </div>
);
