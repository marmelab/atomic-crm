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
import { DashboardNetAvailabilityCard } from "./DashboardNetAvailabilityCard";
import { DashboardYoyBadge } from "./DashboardYoyBadge";
import type { FiscalKpis } from "./fiscalModel";

export const DashboardKpiCards = ({
  kpis,
  meta,
  year: _year,
  compact = false,
  fiscalKpis = null,
  taxesPaid = 0,
}: {
  kpis: DashboardKpis;
  meta: DashboardMeta;
  year: number;
  compact?: boolean;
  fiscalKpis?: FiscalKpis | null;
  taxesPaid?: number;
}) => {
  const delta = kpis.monthlyRevenueDeltaPct;
  const deltaDirection =
    delta == null ? null : delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      <DashboardNetAvailabilityCard
        kpis={kpis}
        fiscalKpis={fiscalKpis}
        meta={meta}
        taxesPaid={taxesPaid}
      />
      <KpiCard
        title="Pagamenti da ricevere"
        value={formatCurrency(kpis.pendingPaymentsTotal)}
        icon={<Clock3 className="h-4 w-4" />}
        accent="amber"
        detail={`${kpis.pendingPaymentsCount} pagamenti attesi`}
        badge="Incassi attesi · non lavoro svolto"
      />
      <KpiCard
        title="Valore del lavoro del mese"
        value={formatCurrency(kpis.monthlyRevenue)}
        icon={<Euro className="h-4 w-4" />}
        accent="blue"
        detail={
          <div className="space-y-0.5">
            <p>
              Km: {Math.round(kpis.monthlyKm)} (
              {formatCompactCurrency(kpis.monthlyKmCost)})
            </p>
            {deltaDirection ? (
              <DeltaBadge
                direction={deltaDirection}
                value={delta}
                compact={compact}
              />
            ) : null}
          </div>
        }
        badge={`Rif. ${meta.monthlyReferenceLabel}`}
      />
      <KpiCard
        title="Valore del lavoro dell'anno"
        value={formatCurrency(kpis.annualRevenue)}
        icon={<Wallet className="h-4 w-4" />}
        accent="indigo"
        detail={
          kpis.yoy ? (
            <DashboardYoyBadge
              deltaPct={kpis.yoy.annualRevenueDeltaPct}
              previousYear={kpis.yoy.previousYear}
              compact={compact}
            />
          ) : null
        }
        badge={meta.operationsPeriodLabel}
      />
      <KpiCard
        title="Preventivi aperti"
        value={`${kpis.openQuotesCount}`}
        icon={<FileText className="h-4 w-4" />}
        accent="sky"
        detail={`Valore: ${formatCurrencyPrecise(kpis.openQuotesAmount)}`}
        badge="Pipeline potenziale"
      />
    </div>
  );
};

type KpiAccent = "blue" | "indigo" | "amber" | "sky";

const accentStyles: Record<
  KpiAccent,
  { border: string; icon: string; value: string }
> = {
  blue: {
    border: "border-l-blue-500",
    icon: "text-blue-600 dark:text-blue-400",
    value: "text-blue-700 dark:text-blue-300",
  },
  indigo: {
    border: "border-l-indigo-500",
    icon: "text-indigo-600 dark:text-indigo-400",
    value: "text-indigo-700 dark:text-indigo-300",
  },
  amber: {
    border: "border-l-amber-500",
    icon: "text-amber-600 dark:text-amber-400",
    value: "text-amber-700 dark:text-amber-300",
  },
  sky: {
    border: "border-l-sky-500",
    icon: "text-sky-600 dark:text-sky-400",
    value: "text-sky-700 dark:text-sky-300",
  },
};

const KpiCard = ({
  title,
  value,
  icon,
  detail,
  badge,
  accent,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  detail?: React.ReactNode;
  badge?: string;
  accent?: KpiAccent;
}) => {
  const style = accent ? accentStyles[accent] : null;

  return (
    <Card className={`gap-3 py-4 ${style ? `border-l-4 ${style.border}` : ""}`}>
      <CardHeader className="px-4 pb-0 flex flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={style?.icon ?? "text-muted-foreground"}>{icon}</div>
      </CardHeader>
      <CardContent className="px-4 space-y-2">
        <div
          className={`text-2xl font-semibold tracking-tight ${style?.value ?? ""}`}
        >
          {value}
        </div>
        {detail && (
          <div className="text-xs text-muted-foreground">{detail}</div>
        )}
        {badge && (
          <Badge variant="outline" className="text-[10px] bg-white dark:bg-background">
            {badge}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};

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
