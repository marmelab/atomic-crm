import { searchOpenRouteLocations } from "./googleMapsService.ts";

export type TravelRouteSuggestPayload = {
  query: string;
};

export type TravelRouteSuggestResponse = Array<{
  label: string;
  longitude: number;
  latitude: number;
}>;

const getString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export const validateTravelRouteSuggestPayload = (
  payload: unknown,
): {
  data: TravelRouteSuggestPayload | null;
  error: string | null;
} => {
  if (!payload || typeof payload !== "object") {
    return {
      data: null,
      error: "Payload non valido per la ricerca luoghi",
    };
  }

  const query = getString((payload as Record<string, unknown>).query);

  if (query.length < 3) {
    return {
      data: null,
      error: "Scrivi almeno 3 caratteri per cercare un luogo",
    };
  }

  return {
    data: {
      query,
    },
    error: null,
  };
};

export const suggestTravelRouteLocations = async ({
  apiKey,
  baseUrl,
  payload,
}: {
  apiKey: string;
  baseUrl: string;
  payload: TravelRouteSuggestPayload;
}): Promise<TravelRouteSuggestResponse> =>
  searchOpenRouteLocations({
    apiKey,
    baseUrl,
    text: payload.query,
    size: 5,
  });
