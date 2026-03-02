import { useGetList } from "ra-core";
import { Euro, TrendingUp, TrendingDown, Car } from "lucide-react";

import type { Client, Expense, Payment, Service } from "../types";

const eur = (n: number) =>
  n.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

type ProjectFinancialRow = {
  project_id: string;
  project_name: string;
  total_fees: number | string;
  total_km: number | string;
  total_km_cost: number | string;
};

const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const ClientFinancialSummary = ({ record }: { record: Client }) => {
  const { data: financials, isPending: fp } = useGetList<ProjectFinancialRow>(
    "project_financials",
    {
      filter: { "client_name@eq": record.name },
      pagination: { page: 1, perPage: 100 },
    },
  );

  const { data: payments, isPending: pp } = useGetList<Payment>("payments", {
    filter: { "client_id@eq": record.id, "status@eq": "ricevuto" },
    pagination: { page: 1, perPage: 100 },
  });

  const { data: expenses, isPending: ep } = useGetList<Expense>("expenses", {
    filter: { "client_id@eq": record.id },
    pagination: { page: 1, perPage: 500 },
  });

  // Services linked directly to the client without a project (flat services)
  const { data: clientServices, isPending: sp } = useGetList<Service>(
    "services",
    {
      filter: {
        "client_id@eq": record.id,
        "project_id@is": null as unknown as string,
      },
      pagination: { page: 1, perPage: 500 },
    },
  );

  if (fp || pp || ep || sp) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  // Fees from project-linked services (via project_financials view)
  const projectFees =
    financials?.reduce((s, f) => s + toNum(f.total_fees), 0) ?? 0;
  const projectKmCost =
    financials?.reduce((s, f) => s + toNum(f.total_km_cost), 0) ?? 0;

  // Fees from projectless services (flat services linked directly to client)
  const directFees =
    clientServices?.reduce(
      (s, svc) =>
        s +
        toNum(svc.fee_shooting) +
        toNum(svc.fee_editing) +
        toNum(svc.fee_other) -
        toNum(svc.discount),
      0,
    ) ?? 0;
  const directKmCost =
    clientServices?.reduce(
      (s, svc) => s + toNum(svc.km_distance) * toNum(svc.km_rate),
      0,
    ) ?? 0;

  const totalFees = projectFees + directFees;
  const totalKmCost = projectKmCost + directKmCost;

  // Non-km expenses: credits subtract, others add (with markup)
  const totalExpenses =
    expenses
      ?.filter((e) => e.expense_type !== "spostamento_km")
      .reduce((s, e) => {
        if (e.expense_type === "credito_ricevuto") return s - toNum(e.amount);
        return s + toNum(e.amount) * (1 + toNum(e.markup_percent) / 100);
      }, 0) ?? 0;

  const totalOwed = totalFees + totalKmCost + totalExpenses;
  // Rimborsi subtract from total paid
  const totalPaid =
    payments?.reduce((s, p) => {
      const amt = toNum(p.amount);
      return p.payment_type === "rimborso" ? s - amt : s + amt;
    }, 0) ?? 0;
  const balanceDue = totalOwed - totalPaid;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricCard
        icon={<Euro className="size-4" />}
        label="Compensi"
        value={eur(totalFees)}
      />
      <MetricCard
        icon={<Car className="size-4" />}
        label="Rimborso km"
        value={eur(totalKmCost)}
        sub={totalExpenses !== 0 ? `+ spese ${eur(totalExpenses)}` : undefined}
      />
      <MetricCard
        icon={<TrendingUp className="size-4" />}
        label="Pagato"
        value={eur(totalPaid)}
        className="text-green-600"
      />
      <MetricCard
        icon={<TrendingDown className="size-4" />}
        label="Da saldare"
        value={eur(balanceDue)}
        className={balanceDue > 0 ? "text-red-600 font-bold" : "text-green-600"}
      />
    </div>
  );
};

const MetricCard = ({
  icon,
  label,
  value,
  sub,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) => (
  <div className="rounded-lg border bg-card p-4">
    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
      {icon}
      {label}
    </div>
    <div className={`text-lg font-semibold ${className ?? ""}`}>{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
  </div>
);
