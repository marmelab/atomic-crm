import {
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  Euro,
  FileText,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  formatCompactCurrency,
  formatCurrency,
  formatCurrencyPrecise,
  type DashboardMeta,
  type DashboardKpis,
} from "./dashboardModel";

export const DashboardKpiCards = ({
  kpis,
  meta,
  year: _year,
  compact = false,
}: {
  kpis: DashboardKpis;
  meta: DashboardMeta;
  year: number;
  compact?: boolean;
}) => {
  const delta = kpis.monthlyRevenueDeltaPct;
  const deltaDirection =
    delta == null ? null : delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiCard
        title="Valore del lavoro del mese"
        value={formatCurrency(kpis.monthlyRevenue)}
        icon={<Euro className="h-4 w-4" />}
        footer={
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              Rif. {meta.monthlyReferenceLabel} · tutto il lavoro svolto
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Km mese: {Math.round(kpis.monthlyKm)} (
                {formatCompactCurrency(kpis.monthlyKmCost)})
              </span>
              {deltaDirection ? (
                <DeltaBadge
                  direction={deltaDirection}
                  value={delta}
                  compact={compact}
                />
              ) : (
                <Badge variant="secondary">N/D</Badge>
              )}
            </div>
          </div>
        }
      />
      <KpiCard
        title="Valore del lavoro dell'anno"
        value={formatCurrency(kpis.annualRevenue)}
        icon={<Wallet className="h-4 w-4" />}
        subtitle={`${meta.operationsPeriodLabel} · tutto il lavoro svolto`}
      />
      <KpiCard
        title="Pagamenti da ricevere"
        value={formatCurrency(kpis.pendingPaymentsTotal)}
        icon={<Clock3 className="h-4 w-4" />}
        subtitle={`${kpis.pendingPaymentsCount} pagamenti attesi: incassi, non lavoro svolto`}
      />
      <KpiCard
        title="Preventivi aperti"
        value={`${kpis.openQuotesCount}`}
        icon={<FileText className="h-4 w-4" />}
        footer={
          <div className="space-y-1 text-xs text-muted-foreground">
            <div>
              Valore aperto: {formatCurrencyPrecise(kpis.openQuotesAmount)}
            </div>
            <div>Pipeline potenziale, non ricavo già acquisito</div>
          </div>
        }
      />
    </div>
  );
};

const KpiCard = ({
  title,
  value,
  icon,
  subtitle,
  footer,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  subtitle?: string;
  footer?: React.ReactNode;
}) => (
  <Card className="gap-3 py-4">
    <CardHeader className="px-4 pb-0 flex flex-row items-center justify-between space-y-0 gap-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <div className="text-muted-foreground">{icon}</div>
    </CardHeader>
    <CardContent className="px-4 space-y-2">
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      {footer ??
        (subtitle ? (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        ) : null)}
    </CardContent>
  </Card>
);

const DeltaBadge = ({
  direction,
  value,
  compact,
}: {
  direction: "up" | "down" | "flat";
  value: number | null;
  compact: boolean;
}) => {
  if (value == null) return null;

  if (direction === "flat") {
    return <Badge variant="secondary">0%</Badge>;
  }

  const Icon = direction === "up" ? ArrowUpRight : ArrowDownRight;
  const variant = direction === "up" ? "success" : "destructive";
  const prefix = direction === "up" ? "+" : "";

  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {prefix}
      {Math.round(value)}%{!compact ? " vs mese prec." : ""}
    </Badge>
  );
};
