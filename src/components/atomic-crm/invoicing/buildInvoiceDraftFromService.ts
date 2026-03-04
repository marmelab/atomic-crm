import {
  calculateKmReimbursement,
  calculateServiceNetValue,
} from "@/lib/semantics/crmSemanticRegistry";

import type { Client, Service } from "../types";
import type { InvoiceDraftInput } from "./invoiceDraftTypes";

const prettifyServiceType = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());

const formatServiceDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }

  return date.toLocaleDateString("it-IT");
};

export const buildInvoiceDraftFromService = ({
  service,
  client,
  defaultKmRate = 0.19,
}: {
  service: Service;
  client: Client;
  defaultKmRate?: number;
}): InvoiceDraftInput => {
  const netValue = calculateServiceNetValue(service);
  const kmValue = calculateKmReimbursement({
    kmDistance: service.km_distance,
    kmRate: service.km_rate,
    defaultKmRate,
  });

  const lineItems = [
    netValue > 0
      ? {
          description: `${prettifyServiceType(service.service_type)} del ${formatServiceDate(service.service_date)}`,
          quantity: 1,
          unitPrice: netValue,
        }
      : null,
    kmValue > 0
      ? {
          description: `Rimborso chilometrico (${service.km_distance} km)`,
          quantity: 1,
          unitPrice: kmValue,
        }
      : null,
  ].filter((lineItem): lineItem is NonNullable<typeof lineItem> =>
    Boolean(lineItem),
  );

  return {
    client,
    lineItems,
    notes: service.notes ?? undefined,
    source: {
      kind: "service",
      id: service.id,
      label: `${prettifyServiceType(service.service_type)} · ${formatServiceDate(service.service_date)}`,
    },
  };
};
