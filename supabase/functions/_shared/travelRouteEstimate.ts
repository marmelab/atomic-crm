import {
  geocodeOpenRouteLocation,
  getOpenRouteDrivingSummary,
} from "./googleMapsService.ts";

export type TravelRouteEstimatePayload = {
  origin: string;
  destination: string;
  tripMode: "one_way" | "round_trip";
  kmRate: number | null;
};

export type TravelRouteEstimateResponse = {
  originQuery: string;
  destinationQuery: string;
  originLabel: string;
  destinationLabel: string;
  tripMode: "one_way" | "round_trip";
  oneWayDistanceKm: number;
  totalDistanceKm: number;
  oneWayDurationMinutes: number;
  totalDurationMinutes: number;
  kmRate: number | null;
  reimbursementAmount: number | null;
  generatedDescription: string;
  generatedLocation: string;
};

const roundToTwoDecimals = (value: number) => Math.round(value * 100) / 100;

const getString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const getOptionalNumber = (value: unknown) => {
  if (value == null || value === "") {
    return null;
  }

  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : null;
};

export const buildTravelRouteDescription = ({
  origin,
  destination,
  tripMode,
}: {
  origin: string;
  destination: string;
  tripMode: "one_way" | "round_trip";
}) =>
  `Spostamento — ${origin.trim()} - ${destination.trim()}${
    tripMode === "round_trip" ? " A/R" : ""
  }`;

export const validateTravelRouteEstimatePayload = (
  payload: unknown,
): {
  data: TravelRouteEstimatePayload | null;
  error: string | null;
} => {
  if (!payload || typeof payload !== "object") {
    return {
      data: null,
      error: "Payload non valido per il calcolo tratta km",
    };
  }

  const origin = getString((payload as Record<string, unknown>).origin);
  const destination = getString(
    (payload as Record<string, unknown>).destination,
  );
  const tripMode = getString((payload as Record<string, unknown>).tripMode);
  const kmRate = getOptionalNumber((payload as Record<string, unknown>).kmRate);

  if (!origin) {
    return {
      data: null,
      error: "Inserisci un luogo di partenza prima di calcolare i km",
    };
  }

  if (!destination) {
    return {
      data: null,
      error: "Inserisci un luogo di arrivo prima di calcolare i km",
    };
  }

  if (tripMode !== "one_way" && tripMode !== "round_trip") {
    return {
      data: null,
      error: "Seleziona se la tratta e' solo andata o andata e ritorno",
    };
  }

  if (kmRate != null && kmRate < 0) {
    return {
      data: null,
      error: "La tariffa km non puo' essere negativa",
    };
  }

  return {
    data: {
      origin,
      destination,
      tripMode,
      kmRate,
    },
    error: null,
  };
};

export const estimateTravelRoute = async ({
  apiKey,
  baseUrl,
  payload,
}: {
  apiKey: string;
  baseUrl: string;
  payload: TravelRouteEstimatePayload;
}): Promise<TravelRouteEstimateResponse> => {
  const [origin, destination] = await Promise.all([
    geocodeOpenRouteLocation({
      apiKey,
      baseUrl,
      text: payload.origin,
    }),
    geocodeOpenRouteLocation({
      apiKey,
      baseUrl,
      text: payload.destination,
    }),
  ]);

  const routeSummary = await getOpenRouteDrivingSummary({
    apiKey,
    baseUrl,
    coordinates: [
      [origin.longitude, origin.latitude],
      [destination.longitude, destination.latitude],
    ],
  });

  const multiplier = payload.tripMode === "round_trip" ? 2 : 1;
  const oneWayDistanceKm = roundToTwoDecimals(
    routeSummary.distanceMeters / 1000,
  );
  const totalDistanceKm = roundToTwoDecimals(
    (routeSummary.distanceMeters * multiplier) / 1000,
  );
  const oneWayDurationMinutes = roundToTwoDecimals(
    routeSummary.durationSeconds / 60,
  );
  const totalDurationMinutes = roundToTwoDecimals(
    (routeSummary.durationSeconds * multiplier) / 60,
  );
  const reimbursementAmount =
    payload.kmRate != null
      ? roundToTwoDecimals(totalDistanceKm * payload.kmRate)
      : null;

  return {
    originQuery: payload.origin,
    destinationQuery: payload.destination,
    originLabel: origin.label,
    destinationLabel: destination.label,
    tripMode: payload.tripMode,
    oneWayDistanceKm,
    totalDistanceKm,
    oneWayDurationMinutes,
    totalDurationMinutes,
    kmRate: payload.kmRate,
    reimbursementAmount,
    generatedDescription: buildTravelRouteDescription({
      origin: payload.origin,
      destination: payload.destination,
      tripMode: payload.tripMode,
    }),
    generatedLocation: payload.destination,
  };
};
