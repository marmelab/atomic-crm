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

const prettifyServiceType = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());

const formatServiceDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }

  return date.toLocaleDateString("it-IT");
};

const buildGroupedProjectLineItems = (
  services: Service[],
): InvoiceDraftLineItem[] => {
  const servicesByType = new Map<string, Service[]>();

  services.forEach((service) => {
    const current = servicesByType.get(service.service_type) ?? [];
    current.push(service);
    servicesByType.set(service.service_type, current);
  });

  return Array.from(servicesByType.entries()).flatMap(
    ([serviceType, typeServices]) => {
      const totalByType = typeServices.reduce(
        (sum, service) => sum + calculateServiceNetValue(service),
        0,
      );

      if (typeServices.length > 5) {
        return [
          {
            description: `${prettifyServiceType(serviceType)} (${typeServices.length} interventi)`,
            quantity: 1,
            unitPrice: totalByType,
          },
        ];
      }

      return typeServices.map((service) => ({
        description: `${prettifyServiceType(service.service_type)} del ${formatServiceDate(service.service_date)}`,
        quantity: 1,
        unitPrice: calculateServiceNetValue(service),
      }));
    },
  );
};

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

  const lineItems = buildGroupedProjectLineItems(projectServices).filter(
    (lineItem) => lineItem.unitPrice !== 0,
  );

  const kmTotal = projectServices.reduce(
    (sum, service) =>
      sum +
      calculateKmReimbursement({
        kmDistance: service.km_distance,
        kmRate: service.km_rate,
        defaultKmRate,
      }),
    0,
  );

  if (kmTotal > 0) {
    lineItems.push({
      description: "Rimborsi chilometrici progetto",
      quantity: 1,
      unitPrice: kmTotal,
    });
  }

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
