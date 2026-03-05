import {
  calculateKmReimbursement,
  calculateServiceNetValue,
} from "@/lib/semantics/crmSemanticRegistry";

import type { Client, Payment, Project, Service } from "../types";
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

const getSignedPaymentAmount = (payment: DraftPayment) =>
  payment.payment_type === "rimborso" ? -payment.amount : payment.amount;

export const buildInvoiceDraftFromProject = ({
  project,
  client,
  services,
  payments = [],
  defaultKmRate = 0.19,
}: {
  project: Project;
  client: Client;
  services: Service[];
  payments?: DraftPayment[];
  defaultKmRate?: number;
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

  const receivedTotal = payments
    .filter((p) => p.status === "ricevuto")
    .reduce((sum, p) => sum + getSignedPaymentAmount(p), 0);

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
