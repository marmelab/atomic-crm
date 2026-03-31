import { useGetList } from "ra-core";
import { Euro, TrendingUp, TrendingDown, Car } from "lucide-react";

import type { Client, Expense, Payment, Service } from "../types";
import { calculateKmReimbursement } from "@/lib/semantics/crmSemanticRegistry";

const eur = (n: number) =>
  n.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Compute the financial amount of an expense using the same CASE logic as
 *  the project_financials view (single source of truth). */
const getExpenseAmount = (e: Expense): number => {
  if (e.expense_type === "credito_ricevuto") return -toNum(e.amount);
  if (e.expense_type === "spostamento_km")
    return calculateKmReimbursement({
      kmDistance: e.km_distance,
      kmRate: e.km_rate,
    });
  return toNum(e.amount) * (1 + toNum(e.markup_percent) / 100);
};

type ProjectFinancialRow = {
  id: number | string;
  project_id: string;
  project_name: string;
  total_fees: number | string;
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

  // All expenses for this client (including auto-created km expenses from trigger)
  const { data: expenses, isPending: ep } = useGetList<Expense>("expenses", {
    filter: { "client_id@eq": record.id },
    pagination: { page: 1, perPage: 500 },
  });

  // Flat services (no project) — fees only, km expenses handled by trigger
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

  // Fees: project-linked (from view) + flat services (manual sum)
  const projectFees =
    financials?.reduce((s, f) => s + toNum(f.total_fees), 0) ?? 0;
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
  const totalFees = projectFees + directFees;

  // Expenses: single source — ALL expenses including auto-created km from trigger
  const totalExpenses =
    expenses?.reduce((s, e) => s + getExpenseAmount(e), 0) ?? 0;

  const totalOwed = totalFees + totalExpenses;

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
        label="Spese"
        value={eur(totalExpenses)}
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
