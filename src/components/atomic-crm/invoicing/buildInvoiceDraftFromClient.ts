import {
  calculateKmReimbursement,
  calculateServiceNetValue,
} from "@/lib/semantics/crmSemanticRegistry";

import type { Client, Project, Service } from "../types";
import {
  type InvoiceDraftInput,
  type InvoiceDraftLineItem,
} from "./invoiceDraftTypes";

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
}: {
  client: Client;
  services: Service[];
  projects: Project[];
  defaultKmRate?: number;
}): InvoiceDraftInput => {
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
    const netTotal = groupServices.reduce(
      (sum, service) => sum + calculateServiceNetValue(service),
      0,
    );

    if (netTotal !== 0) {
      lineItems.push({
        description: `${projectLabel} · Servizi`,
        quantity: 1,
        unitPrice: netTotal,
      });
    }

    const kmTotal = groupServices.reduce(
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
        description: `${projectLabel} · Rimborsi chilometrici`,
        quantity: 1,
        unitPrice: kmTotal,
      });
    }
  });

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
