import type { Quote, Service } from "../types";

/**
 * Maps quote service types to CRM service types.
 * Quote types are commercial categories; service types are operational.
 */
const quoteToServiceTypeMap: Record<string, Service["service_type"]> = {
  wedding: "riprese_montaggio",
  spot: "riprese_montaggio",
  fotografia: "fotografia",
  sito_web: "sviluppo_web",
  produzione_tv: "riprese",
  altro: "altro",
};

export const quoteStatusesEligibleForServiceCreation = new Set([
  "accettato",
  "acconto_ricevuto",
  "in_lavorazione",
  "completato",
  "saldato",
]);

export const canCreateServiceFromQuote = (
  quote: Pick<Quote, "status">,
) => quoteStatusesEligibleForServiceCreation.has(quote.status);

export type ServiceDraftFromQuote = Pick<
  Service,
  | "service_type"
  | "service_date"
  | "service_end"
  | "all_day"
  | "is_taxable"
  | "fee_shooting"
  | "fee_editing"
  | "fee_other"
  | "discount"
  | "km_distance"
  | "km_rate"
> &
  Partial<
    Pick<Service, "project_id" | "client_id" | "description" | "notes">
  >;

export const getSuggestedServiceTypeFromQuote = (
  quoteServiceType?: string,
): Service["service_type"] =>
  (quoteServiceType && quoteToServiceTypeMap[quoteServiceType]) ?? "altro";

export const buildServiceDraftFromQuote = ({
  quote,
}: {
  quote: Pick<
    Quote,
    | "client_id"
    | "project_id"
    | "service_type"
    | "description"
    | "event_start"
    | "event_end"
    | "all_day"
    | "amount"
    | "is_taxable"
  >;
}): ServiceDraftFromQuote => ({
  client_id: quote.client_id,
  project_id: quote.project_id ?? undefined,
  service_type: getSuggestedServiceTypeFromQuote(quote.service_type),
  description: quote.description,
  service_date: quote.event_start ?? new Date().toISOString().slice(0, 10),
  service_end: quote.event_end,
  all_day: quote.all_day,
  is_taxable: quote.is_taxable,
  fee_shooting: 0,
  fee_editing: 0,
  fee_other: quote.amount > 0 ? quote.amount : 0,
  discount: 0,
  km_distance: 0,
  km_rate: 0,
});
