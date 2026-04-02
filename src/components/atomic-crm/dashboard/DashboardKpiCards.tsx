import {
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  Euro,
  FileText,
  Wallet,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  formatCompactCurrency,
  formatCurrency,
  type DashboardMeta,
  type DashboardKpis,
} from "./dashboardModel";
import { DashboardNetAvailabilityCard } from "./DashboardNetAvailabilityCard";
import type { FiscalKpis } from "./fiscalModel";

export const DashboardKpiCards = ({
  kpis,
  meta,
  year: _year,
  compact,
  fiscalKpis = null,
  totalOpenObligations,
}: {
  kpis: DashboardKpis;
  meta: DashboardMeta;
  year: number;
  compact?: boolean;
  fiscalKpis?: FiscalKpis | null;
  totalOpenObligations?: number;
}) => (
  <div
    className={`grid grid-cols-1 sm:grid-cols-2 ${compact ? "gap-3" : "xl:grid-cols-5 gap-4"}`}
  >
    <DashboardNetAvailabilityCard
      kpis={kpis}
      fiscalKpis={fiscalKpis}
      meta={meta}
      totalOpenObligations={totalOpenObligations}
    />

    {/* ── Pagamenti da ricevere ── */}
    <PendingPaymentsCard kpis={kpis} />

    {/* ── Lavoro mese ── */}
    <MonthlyRevenueCard kpis={kpis} meta={meta} />

    {/* ── Lavoro anno ── */}
    <AnnualRevenueCard kpis={kpis} meta={meta} />

    {/* ── Preventivi aperti ── */}
    <OpenQuotesCard kpis={kpis} />
  </div>
);

/* ─────────────────────────────────────────────────────── */

const PendingPaymentsCard = ({ kpis }: { kpis: DashboardKpis }) => {
  const received = kpis.cashReceivedNet;
  const pending = kpis.pendingPaymentsTotal;
  const total = received + pending;
  const pct = total > 0 ? Math.round((received / total) * 100) : 0;

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4 pb-0 flex flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-base font-semibold">Da incassare</CardTitle>
        <Clock3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      </CardHeader>
      <CardContent className="px-4 space-y-2">
        <div className="text-2xl font-bold text-amber-700 dark:text-amber-300 tabular-nums">
          {formatCurrency(pending)}
        </div>
        <p className="text-xs text-muted-foreground">
          {kpis.pendingPaymentsCount} pagamenti in attesa
        </p>
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground text-center tabular-nums">
            {formatCompactCurrency(received)} incassati su{" "}
            {formatCompactCurrency(total)} ({pct}%)
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

const MonthlyRevenueCard = ({
  kpis,
  meta,
}: {
  kpis: DashboardKpis;
  meta: DashboardMeta;
}) => {
  const delta = kpis.monthlyRevenueDeltaPct;

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4 pb-0 flex flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-base font-semibold">
          Lavoro del mese
        </CardTitle>
        <Euro className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      </CardHeader>
      <CardContent className="px-4 space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-blue-700 dark:text-blue-300 tabular-nums">
            {formatCurrency(kpis.monthlyRevenue)}
          </span>
          <DeltaArrow value={delta} />
        </div>
        <p className="text-xs text-muted-foreground">
          {meta.monthlyReferenceLabel}
        </p>
        {kpis.monthlyKm > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {Math.round(kpis.monthlyKm)} km ·{" "}
            {formatCompactCurrency(kpis.monthlyKmCost)}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const AnnualRevenueCard = ({
  kpis,
  meta,
}: {
  kpis: DashboardKpis;
  meta: DashboardMeta;
}) => {
  const yoyDelta = kpis.yoy?.annualRevenueDeltaPct ?? null;

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4 pb-0 flex flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-base font-semibold">
          Lavoro dell'anno
        </CardTitle>
        <Wallet className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
      </CardHeader>
      <CardContent className="px-4 space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">
            {formatCurrency(kpis.annualRevenue)}
          </span>
          <DeltaArrow
            value={yoyDelta}
            label={kpis.yoy ? `vs ${kpis.yoy.previousYear}` : undefined}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {meta.operationsPeriodLabel}
        </p>
      </CardContent>
    </Card>
  );
};

const OpenQuotesCard = ({ kpis }: { kpis: DashboardKpis }) => (
  <Card className="gap-3 py-4">
    <CardHeader className="px-4 pb-0 flex flex-row items-center justify-between space-y-0 gap-2">
      <CardTitle className="text-base font-semibold">
        Preventivi aperti
      </CardTitle>
      <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400" />
    </CardHeader>
    <CardContent className="px-4 space-y-2">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-0">
        <div className="text-center min-w-0">
          <div className="text-xl sm:text-2xl font-bold text-sky-700 dark:text-sky-300">
            {kpis.openQuotesCount}
          </div>
          <p className="text-[11px] text-muted-foreground">aperti</p>
        </div>
        <Separator orientation="vertical" className="h-8" />
        <div className="text-center min-w-0">
          <div className="text-xl sm:text-2xl font-bold text-sky-700 dark:text-sky-300 tabular-nums">
            {formatCompactCurrency(kpis.openQuotesAmount)}
          </div>
          <p className="text-[11px] text-muted-foreground">valore</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

/* ─────────────────────────────────────────────────────── */

const DeltaArrow = ({
  value,
  label,
}: {
  value: number | null;
  label?: string;
}) => {
  if (value == null) return null;

  const isUp = value > 0;
  const isFlat = value === 0;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;

  if (isFlat) {
    return (
      <span className="text-xs text-muted-foreground font-medium">
        0% {label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
        isUp
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {isUp ? "+" : ""}
      {Math.round(value)}%
      {label && (
        <span className="font-normal text-muted-foreground ml-0.5">
          {label}
        </span>
      )}
    </span>
  );
};
