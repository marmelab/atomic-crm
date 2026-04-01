import {
  calculateKmReimbursement,
  calculateServiceNetValue,
} from "@/lib/semantics/crmSemanticRegistry";

import type { Client, Expense, Payment, Project, Service } from "../types";
import type {
  InvoiceDraftInput,
  InvoiceDraftLineItem,
} from "./invoiceDraftTypes";
import { getInvoiceDraftLineTotal } from "./invoiceDraftTypes";
import {
  buildServiceLineDescription,
  buildKmLineDescription,
} from "./buildInvoiceDraftFromService";

type DraftPayment = Pick<Payment, "amount" | "payment_type" | "status">;

export const buildInvoiceDraftFromProject = ({
  project,
  client,
  services,
  payments = [],
  defaultKmRate = 0.19,
  expenses = [],
}: {
  project: Project;
  client: Client;
  services: Service[];
  payments?: DraftPayment[];
  defaultKmRate?: number;
  expenses?: Expense[];
}): InvoiceDraftInput => {
  const projectServices = services
    .filter(
      (service) =>
        String(service.project_id) === String(project.id) &&
        (!service.invoice_ref || service.invoice_ref.trim().length === 0),
    )
    .sort(
      (left, right) =>
        new Date(left.service_date).valueOf() -
        new Date(right.service_date).valueOf(),
    );

  const lineItems: InvoiceDraftLineItem[] = projectServices.flatMap(
    (service) => {
      const items: InvoiceDraftLineItem[] = [];

      const netValue = calculateServiceNetValue(service);
      if (netValue > 0) {
        items.push({
          description: buildServiceLineDescription(service),
          quantity: 1,
          unitPrice: netValue,
        });
      }

      const kmValue = calculateKmReimbursement({
        kmDistance: service.km_distance,
        kmRate: service.km_rate,
        defaultKmRate,
      });
      if (kmValue > 0) {
        items.push({
          description: buildKmLineDescription(service, defaultKmRate),
          quantity: 1,
          unitPrice: kmValue,
        });
      }

      return items;
    },
  );

  // Expense line items (billable, not yet invoiced)
  for (const expense of expenses.filter(
    (e) =>
      String(e.project_id) === String(project.id) &&
      (!e.invoice_ref || e.invoice_ref.trim().length === 0),
  )) {
    const amount =
      expense.expense_type === "credito_ricevuto"
        ? -Number(expense.amount ?? 0)
        : expense.expense_type === "spostamento_km"
          ? (expense.km_distance ?? 0) * (expense.km_rate ?? defaultKmRate)
          : Number(expense.amount ?? 0) *
            (1 + (expense.markup_percent ?? 0) / 100);

    if (amount !== 0) {
      lineItems.push({
        description: `Spesa: ${expense.description || expense.expense_type}`,
        quantity: 1,
        unitPrice: amount,
      });
    }
  }

  // Invoice Draft Sign Rule: rimborso excluded (already handled in commercial position)
  const receivedTotal = payments
    .filter((p) => p.status === "ricevuto" && p.payment_type !== "rimborso")
    .reduce((sum, p) => sum + p.amount, 0);

  if (receivedTotal !== 0) {
    lineItems.push({
      description: "Pagamenti gia ricevuti",
      quantity: 1,
      unitPrice: -receivedTotal,
    });
  }

  const collectableAmount = lineItems.reduce(
    (sum, li) => sum + getInvoiceDraftLineTotal(li),
    0,
  );

  return {
    client,
    lineItems: collectableAmount > 0 ? lineItems : [],
    notes: project.notes ?? undefined,
    source: {
      kind: "project",
      id: project.id,
      label: project.name,
    },
  };
};
