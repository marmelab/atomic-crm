import {
  calculateKmReimbursement,
  calculateServiceNetValue,
} from "@/lib/semantics/crmSemanticRegistry";

import type { Client, Expense, Payment, Project, Service } from "../types";
import {
  getInvoiceDraftLineTotal,
  type InvoiceDraftInput,
  type InvoiceDraftLineItem,
} from "./invoiceDraftTypes";
import {
  buildServiceLineDescription,
  buildKmLineDescription,
} from "./buildInvoiceDraftFromService";

const PROJECTLESS_KEY = "__client_level__";

const getProjectLabel = ({
  projectId,
  projectsById,
}: {
  projectId: string;
  projectsById: Map<string, Project>;
}) => {
  if (projectId === PROJECTLESS_KEY) {
    return "Servizi senza progetto";
  }

  return projectsById.get(projectId)?.name ?? "Progetto";
};

export const buildInvoiceDraftFromClient = ({
  client,
  services,
  projects,
  defaultKmRate = 0.19,
  expenses = [],
  payments = [],
}: {
  client: Client;
  services: Service[];
  projects: Project[];
  defaultKmRate?: number;
  expenses?: Expense[];
  payments?: Payment[];
}): InvoiceDraftInput | null => {
  const projectsById = new Map(
    projects.map((project) => [String(project.id), project]),
  );
  const clientServices = services.filter(
    (service) =>
      String(service.client_id) === String(client.id) &&
      (!service.invoice_ref || service.invoice_ref.trim().length === 0),
  );

  const grouped = new Map<string, Service[]>();

  clientServices.forEach((service) => {
    const key = service.project_id
      ? String(service.project_id)
      : PROJECTLESS_KEY;
    const current = grouped.get(key) ?? [];
    current.push(service);
    grouped.set(key, current);
  });

  const lineItems: InvoiceDraftLineItem[] = [];

  grouped.forEach((groupServices, projectId) => {
    const projectLabel = getProjectLabel({ projectId, projectsById });

    const sorted = [...groupServices].sort(
      (a, b) =>
        new Date(a.service_date).valueOf() - new Date(b.service_date).valueOf(),
    );

    sorted.forEach((service) => {
      const netValue = calculateServiceNetValue(service);
      if (netValue > 0) {
        lineItems.push({
          description: `${projectLabel} · ${buildServiceLineDescription(service)}`,
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
        lineItems.push({
          description: `${projectLabel} · ${buildKmLineDescription(service, defaultKmRate)}`,
          quantity: 1,
          unitPrice: kmValue,
        });
      }
    });
  });

  // Expense line items (billable, not yet invoiced)
  for (const expense of expenses.filter(
    (e) =>
      String(e.client_id) === String(client.id) &&
      (!e.invoice_ref || e.invoice_ref.trim().length === 0),
  )) {
    const projectLabel = expense.project_id
      ? getProjectLabel({
          projectId: String(expense.project_id),
          projectsById,
        })
      : "Spesa cliente";

    const amount =
      expense.expense_type === "credito_ricevuto"
        ? -Number(expense.amount ?? 0)
        : expense.expense_type === "spostamento_km"
          ? (expense.km_distance ?? 0) * (expense.km_rate ?? defaultKmRate)
          : Number(expense.amount ?? 0) *
            (1 + (expense.markup_percent ?? 0) / 100);

    if (amount !== 0) {
      lineItems.push({
        description: `${projectLabel} · Spesa: ${expense.description || expense.expense_type}`,
        quantity: 1,
        unitPrice: amount,
      });
    }
  }

  // Invoice Draft Sign Rule: rimborso excluded (already handled in commercial position)
  const receivedTotal = payments
    .filter(
      (p) =>
        String(p.client_id) === String(client.id) &&
        p.status === "ricevuto" &&
        p.payment_type !== "rimborso",
    )
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  if (receivedTotal !== 0) {
    lineItems.push({
      description: "Pagamenti gia ricevuti",
      quantity: 1,
      unitPrice: -receivedTotal,
    });
  }

  // Only return if there's something to collect
  const collectableAmount = lineItems.reduce(
    (sum, item) => sum + getInvoiceDraftLineTotal(item),
    0,
  );
  if (collectableAmount <= 0) return null;

  return {
    client,
    lineItems,
    source: {
      kind: "client",
      id: client.id,
      label: client.name,
    },
  };
};
