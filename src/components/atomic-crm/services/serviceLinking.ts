import type { Identifier } from "ra-core";

import type { Service } from "../types";

type ServiceCreateDefaults = Partial<
  Pick<
    Service,
    | "project_id"
    | "service_date"
    | "service_type"
    | "description"
    | "km_distance"
    | "km_rate"
    | "location"
    | "notes"
  >
>;

type UnifiedAiServiceHandoffAction =
  | "service_create"
  | "follow_unified_crm_handoff";

type UnifiedAiServiceHandoffSource = "unified_ai_launcher";

export type UnifiedAiServiceHandoffContext = {
  source: UnifiedAiServiceHandoffSource;
  action: UnifiedAiServiceHandoffAction | null;
};

const toOptionalIdentifier = (value?: string | null) =>
  value == null || value === "" ? null : value;

const getOptionalNumber = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null;
};

const serviceTypes = new Set<Service["service_type"]>([
  "riprese",
  "montaggio",
  "riprese_montaggio",
  "fotografia",
  "sviluppo_web",
  "altro",
]);

const getOptionalServiceType = (value?: string | null) =>
  value && serviceTypes.has(value as Service["service_type"])
    ? (value as Service["service_type"])
    : null;

const getOptionalText = (value?: string | null) => {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
};

const unifiedAiServiceHandoffActions = new Set<UnifiedAiServiceHandoffAction>([
  "service_create",
  "follow_unified_crm_handoff",
]);

export const getServiceCreateDefaultsFromSearch = (
  search: string,
): ServiceCreateDefaults => {
  const searchParams = new URLSearchParams(search);
  const defaults: ServiceCreateDefaults = {};

  const projectId = toOptionalIdentifier(searchParams.get("project_id"));
  if (projectId) {
    defaults.project_id = projectId;
  }

  const serviceDate = searchParams.get("service_date");
  if (serviceDate) {
    defaults.service_date = serviceDate;
  }

  const serviceType = getOptionalServiceType(searchParams.get("service_type"));
  if (serviceType) {
    defaults.service_type = serviceType;
  }

  const description = getOptionalText(searchParams.get("description"));
  if (description) {
    defaults.description = description;
  }

  const kmDistance = getOptionalNumber(searchParams.get("km_distance"));
  if (kmDistance != null) {
    defaults.km_distance = kmDistance;
  }

  const kmRate = getOptionalNumber(searchParams.get("km_rate"));
  if (kmRate != null) {
    defaults.km_rate = kmRate;
  }

  const location = getOptionalText(searchParams.get("location"));
  if (location) {
    defaults.location = location;
  }

  const notes = getOptionalText(searchParams.get("notes"));
  if (notes) {
    defaults.notes = notes;
  }

  return defaults;
};

export const getUnifiedAiServiceHandoffContextFromSearch = (
  search: string,
): UnifiedAiServiceHandoffContext | null => {
  const searchParams = new URLSearchParams(search);
  const source = searchParams.get("launcher_source");

  if (source !== "unified_ai_launcher") {
    return null;
  }

  const action = searchParams.get("launcher_action");

  return {
    source,
    action:
      action &&
      unifiedAiServiceHandoffActions.has(
        action as UnifiedAiServiceHandoffAction,
      )
        ? (action as UnifiedAiServiceHandoffAction)
        : null,
  };
};

export const getUnifiedAiServiceBannerCopy = (search: string) => {
  const handoff = getUnifiedAiServiceHandoffContextFromSearch(search);

  if (!handoff) {
    return null;
  }

  if (handoff.action === "service_create") {
    return "Aperto dalla chat AI unificata con un servizio gia collegato al progetto corretto. Controlla data, tipo servizio, chilometri e note prima di salvare; per spese extra non km continua dalla superficie Spese collegata.";
  }

  return "Aperto dalla chat AI unificata: il form e' stato indirizzato qui come superficie servizi gia approvata. Verifica i dati prima di salvare.";
};

export const buildServiceCreatePathFromProject = ({
  project_id,
  service_date,
  service_type,
  description,
  km_distance,
  km_rate,
  location,
  notes,
}: {
  project_id?: Identifier | null;
  service_date?: string | null;
  service_type?: Service["service_type"] | null;
  description?: string | null;
  km_distance?: number | null;
  km_rate?: number | null;
  location?: string | null;
  notes?: string | null;
}) => {
  const searchParams = new URLSearchParams();

  searchParams.set("launcher_source", "unified_ai_launcher");
  searchParams.set("launcher_action", "service_create");

  if (project_id != null && project_id !== "") {
    searchParams.set("project_id", String(project_id));
  }

  if (service_date) {
    searchParams.set("service_date", service_date);
  }

  if (service_type) {
    searchParams.set("service_type", service_type);
  }

  if (description) {
    searchParams.set("description", description);
  }

  if (km_distance != null && Number.isFinite(km_distance)) {
    searchParams.set("km_distance", String(km_distance));
  }

  if (km_rate != null && Number.isFinite(km_rate)) {
    searchParams.set("km_rate", String(km_rate));
  }

  if (location) {
    searchParams.set("location", location);
  }

  if (notes) {
    searchParams.set("notes", notes);
  }

  return `/services/create?${searchParams.toString()}`;
};
