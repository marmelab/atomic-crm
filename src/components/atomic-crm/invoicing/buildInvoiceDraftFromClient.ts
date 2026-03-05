import {
  calculateKmReimbursement,
  calculateServiceNetValue,
} from "@/lib/semantics/crmSemanticRegistry";

import type { Client, Project, Service } from "../types";
import {
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

    const sorted = [...groupServices].sort(
      (a, b) =>
        new Date(a.service_date).valueOf() -
        new Date(b.service_date).valueOf(),
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
