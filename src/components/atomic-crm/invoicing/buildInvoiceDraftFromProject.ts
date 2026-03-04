import {
  calculateKmReimbursement,
  calculateServiceNetValue,
} from "@/lib/semantics/crmSemanticRegistry";

import type { Client, Project, Service } from "../types";
import type {
  InvoiceDraftInput,
  InvoiceDraftLineItem,
} from "./invoiceDraftTypes";

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

export const buildInvoiceDraftFromProject = ({
  project,
  client,
  services,
  defaultKmRate = 0.19,
}: {
  project: Project;
  client: Client;
  services: Service[];
  defaultKmRate?: number;
}): InvoiceDraftInput => {
  const projectServices = services
    .filter((service) => String(service.project_id) === String(project.id))
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

  return {
    client,
    lineItems,
    notes: project.notes ?? undefined,
    source: {
      kind: "project",
      id: project.id,
      label: project.name,
    },
  };
};
