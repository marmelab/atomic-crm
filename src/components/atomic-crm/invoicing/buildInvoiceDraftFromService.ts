import {
  calculateKmReimbursement,
  calculateServiceNetValue,
} from "@/lib/semantics/crmSemanticRegistry";

import type { Client, Service } from "../types";
import type { InvoiceDraftInput } from "./invoiceDraftTypes";
import { formatDateRange } from "../misc/formatDateRange";

const prettifyServiceType = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());

/**
 * Build a comprehensive line-item description from all populated service
 * fields so the invoice draft is self-explanatory.
 *
 * Pattern: "{description} · {ServiceType} del {date range} · {location}"
 * Parts are omitted when the underlying field is empty/null.
 */
const buildServiceLineDescription = (service: Service): string => {
  const parts: string[] = [];

  const serviceType = prettifyServiceType(service.service_type);
  const dateRange = formatDateRange(
    service.service_date,
    service.service_end,
    service.all_day,
  );

  if (service.description?.trim()) {
    parts.push(service.description.trim());
  }

  parts.push(dateRange ? `${serviceType} del ${dateRange}` : serviceType);

  if (service.location?.trim()) {
    parts.push(service.location.trim());
  }

  return parts.join(" · ");
};

const formatKmRate = (rate: number) =>
  rate.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * Build a comprehensive km reimbursement description showing route,
 * trip mode, distance and rate per km.
 *
 * Note: `service.location` is the venue where the service took place,
 * NOT the travel route. Route info comes from `travel_origin`,
 * `travel_destination` and `trip_mode`.
 *
 * Examples:
 *   "Rimborso chilometrico · Catania – Agrigento A/R · 200 km × €0,40/km"
 *   "Rimborso chilometrico · 120 km × €0,19/km"  (no route data)
 */
const buildKmLineDescription = (
  service: Service,
  defaultKmRate: number,
): string => {
  const parts: string[] = ["Rimborso chilometrico"];

  if (service.travel_origin?.trim() && service.travel_destination?.trim()) {
    const route = `${service.travel_origin.trim()} – ${service.travel_destination.trim()}`;
    parts.push(
      service.trip_mode === "round_trip" ? `${route} A/R` : route,
    );
  }

  const effectiveRate = service.km_rate || defaultKmRate;
  parts.push(`${service.km_distance} km × €${formatKmRate(effectiveRate)}/km`);

  return parts.join(" · ");
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
  const isAlreadyInvoiced =
    typeof service.invoice_ref === "string" &&
    service.invoice_ref.trim().length > 0;

  const netValue = calculateServiceNetValue(service);
  const kmValue = calculateKmReimbursement({
    kmDistance: service.km_distance,
    kmRate: service.km_rate,
    defaultKmRate,
  });

  const lineItems = isAlreadyInvoiced
    ? []
    : [
        netValue > 0
          ? {
              description: buildServiceLineDescription(service),
              quantity: 1,
              unitPrice: netValue,
            }
          : null,
        kmValue > 0
          ? {
              description: buildKmLineDescription(service, defaultKmRate),
              quantity: 1,
              unitPrice: kmValue,
            }
          : null,
      ].filter((lineItem): lineItem is NonNullable<typeof lineItem> =>
        Boolean(lineItem),
      );

  const dateRange = formatDateRange(
    service.service_date,
    service.service_end,
    service.all_day,
  );

  return {
    client,
    lineItems,
    notes: service.notes ?? undefined,
    source: {
      kind: "service",
      id: service.id,
      label: service.description
        ? `${service.description.trim()} · ${dateRange}`
        : `${prettifyServiceType(service.service_type)} · ${dateRange}`,
    },
  };
};
