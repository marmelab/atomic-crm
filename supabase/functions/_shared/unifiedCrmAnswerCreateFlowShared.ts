import type {
  ParsedUnifiedCrmInvoiceDraftQuestion,
  ParsedUnifiedCrmProjectQuickEpisodeQuestion,
  UnifiedCrmTravelRouteCandidate,
} from "./unifiedCrmAnswerTypes.ts";
import { includesAny } from "./unifiedCrmAnswerUtils.ts";

const roundTripPatterns = [
  "andata e ritorno",
  "andate e ritorno",
  "andata ritorno",
  "andate ritorno",
  "andata che il ritorno",
  "sia l'andata che il ritorno",
  "a/r",
  "a-r",
];

export const hasRoundTripIntent = (normalizedQuestion: string) =>
  includesAny(normalizedQuestion, roundTripPatterns);

export const buildTravelRouteLabel = (
  route: UnifiedCrmTravelRouteCandidate,
  isRoundTrip: boolean,
) => `${route.origin} - ${route.destination}${isRoundTrip ? " A/R" : ""}`;

export const getRequestedWorkLabelInfo = (
  requestedLabel: ParsedUnifiedCrmProjectQuickEpisodeQuestion["requestedLabel"],
) => {
  if (requestedLabel === "puntata") {
    return {
      noun: "puntata",
      article: "questa puntata",
      dialogLabel: "Puntata",
    };
  }

  if (requestedLabel === "servizio") {
    return {
      noun: "servizio",
      article: "questo servizio",
      dialogLabel: "servizio",
    };
  }

  return {
    noun: "lavoro",
    article: "questo lavoro",
    dialogLabel: "servizio",
  };
};

export const invoiceDraftResourceMap: Record<
  ParsedUnifiedCrmInvoiceDraftQuestion["surface"],
  "quotes" | "projects" | "clients"
> = {
  quote: "quotes",
  project: "projects",
  client: "clients",
};

export const invoiceDraftSurfaceLabelMap: Record<
  ParsedUnifiedCrmInvoiceDraftQuestion["surface"],
  string
> = {
  quote: "preventivo",
  project: "progetto",
  client: "cliente",
};
