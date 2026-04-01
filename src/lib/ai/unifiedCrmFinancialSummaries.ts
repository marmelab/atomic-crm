import type {
  ClientCommercialPosition,
  Expense,
  ProjectFinancialRow,
  Supplier,
} from "@/components/atomic-crm/types";
import { calculateKmReimbursement } from "@/lib/semantics/crmSemanticRegistry";

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

export const mapProjectFinancialRows = (
  rows: ProjectFinancialRow[],
): Map<string, ProjectFinancialSummary> => {
  const summaries = new Map<string, ProjectFinancialSummary>();
  for (const row of rows) {
    summaries.set(row.project_id, {
      totalServices: row.total_services,
      totalFees: row.total_fees,
      totalExpenses: row.total_expenses,
      totalPaid: row.total_paid,
      balanceDue: row.balance_due,
    });
  }
  return summaries;
};

// ── Client financial summaries ────────────────────────────────────────

export const mapClientCommercialPositions = (
  rows: ClientCommercialPosition[],
  uninvoicedCountByClient: Map<string, number>,
) =>
  rows.map((row) => ({
    clientId: row.client_id,
    clientName: row.client_name,
    totalFees: row.total_fees,
    totalExpenses: row.total_expenses,
    totalPaid: row.total_paid,
    balanceDue: row.balance_due,
    hasUninvoicedServices:
      (uninvoicedCountByClient.get(row.client_id) ?? 0) > 0,
  }));

// ── Supplier financial summaries ─────────────────────────────────────

export const buildSupplierFinancialSummaries = ({
  expenses,
  supplierById,
}: {
  expenses: Expense[];
  supplierById: Map<string, Supplier>;
}) => {
  const totals = new Map<string, { totalExpenses: number; expenseCount: number }>();

  for (const expense of expenses) {
    if (!expense.supplier_id) continue;
    const supplierId = String(expense.supplier_id);
    const current = totals.get(supplierId) ?? { totalExpenses: 0, expenseCount: 0 };
    current.totalExpenses += getExpenseOperationalAmount(expense);
    current.expenseCount += 1;
    totals.set(supplierId, current);
  }

  return Array.from(totals.entries())
    .map(([supplierId, t]) => ({
      supplierId,
      supplierName: supplierById.get(supplierId)?.name ?? "Fornitore",
      totalExpenses: t.totalExpenses,
      expenseCount: t.expenseCount,
    }))
    .filter((s) => s.totalExpenses !== 0)
    .sort((a, b) => b.totalExpenses - a.totalExpenses);
};
