import type {
  Client,
  Expense,
  Payment,
  Service,
} from "@/components/atomic-crm/types";
import {
  calculateKmReimbursement,
  calculateServiceNetValue,
} from "@/lib/semantics/crmSemanticRegistry";

// ── Expense amount helper ─────────────────────────────────────────────

export const getExpenseOperationalAmount = (expense: Expense) => {
  if (expense.expense_type === "credito_ricevuto") {
    return -Number(expense.amount ?? 0);
  }

  if (expense.expense_type === "spostamento_km") {
    return calculateKmReimbursement({
      kmDistance: expense.km_distance,
      kmRate: expense.km_rate,
    });
  }

  return (
    Number(expense.amount ?? 0) *
    (1 + Number(expense.markup_percent ?? 0) / 100)
  );
};

// ── Project financial summaries ───────────────────────────────────────

export type ProjectFinancialSummary = {
  totalServices: number;
  totalFees: number;
  totalExpenses: number;
  totalPaid: number;
  balanceDue: number;
};

export const buildProjectFinancialSummaries = ({
  projects,
  services,
  payments,
  expenses,
}: {
  projects: Array<{ id: string | number }>;
  services: Service[];
  payments: Payment[];
  expenses: Expense[];
}) => {
  const summaries = new Map<string, ProjectFinancialSummary>(
    projects.map((project) => [
      String(project.id),
      {
        totalServices: 0,
        totalFees: 0,
        totalExpenses: 0,
        totalPaid: 0,
        balanceDue: 0,
      },
    ]),
  );

  services.forEach((service) => {
    const projectId = service.project_id ? String(service.project_id) : null;
    if (!projectId) return;

    const current = summaries.get(projectId);
    if (!current) return;

    current.totalServices += 1;
    current.totalFees += calculateServiceNetValue(service);
  });

  expenses.forEach((expense) => {
    const projectId = expense.project_id ? String(expense.project_id) : null;
    if (!projectId) return;

    const current = summaries.get(projectId);
    if (!current) return;

    current.totalExpenses += getExpenseOperationalAmount(expense);
  });

  payments.forEach((payment) => {
    const projectId = payment.project_id ? String(payment.project_id) : null;
    if (!projectId || payment.status !== "ricevuto") return;

    const current = summaries.get(projectId);
    if (!current) return;

    current.totalPaid +=
      payment.payment_type === "rimborso"
        ? -Number(payment.amount ?? 0)
        : Number(payment.amount ?? 0);
  });

  summaries.forEach((summary) => {
    summary.balanceDue =
      summary.totalFees + summary.totalExpenses - summary.totalPaid;
  });

  return summaries;
};

// ── Client financial summaries ────────────────────────────────────────

export const buildClientFinancialSummaries = ({
  services,
  payments,
  clientById,
}: {
  services: Service[];
  payments: Payment[];
  clientById: Map<string, Client>;
}) => {
  const totals = new Map<
    string,
    {
      totalFees: number;
      totalPaid: number;
      uninvoicedServices: number;
    }
  >();

  const ensure = (clientId: string) => {
    if (!totals.has(clientId)) {
      totals.set(clientId, {
        totalFees: 0,
        totalPaid: 0,
        uninvoicedServices: 0,
      });
    }
    return totals.get(clientId)!;
  };

  for (const service of services) {
    if (!service.client_id) continue;
    const clientId = String(service.client_id);
    const t = ensure(clientId);
    t.totalFees += calculateServiceNetValue(service);
    if (!service.invoice_ref || service.invoice_ref.trim().length === 0) {
      t.uninvoicedServices += 1;
    }
  }

  for (const payment of payments) {
    if (payment.status !== "ricevuto" || !payment.client_id) continue;
    const clientId = String(payment.client_id);
    const t = ensure(clientId);
    t.totalPaid +=
      payment.payment_type === "rimborso"
        ? -Number(payment.amount ?? 0)
        : Number(payment.amount ?? 0);
  }

  return Array.from(totals.entries())
    .map(([clientId, t]) => ({
      clientId,
      clientName: clientById.get(clientId)?.name ?? "Cliente",
      totalFees: t.totalFees,
      totalPaid: t.totalPaid,
      balanceDue: t.totalFees - t.totalPaid,
      hasUninvoicedServices: t.uninvoicedServices > 0,
    }))
    .filter((c) => c.totalFees !== 0 || c.totalPaid !== 0)
    .sort((a, b) => b.balanceDue - a.balanceDue);
};
