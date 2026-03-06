// Google Maps APIs service — replaces the previous OpenRouteService module.
// Keeps the same exported types for backward compatibility with callers.

export type OpenRouteResolvedLocation = {
  query: string;
  label: string;
  longitude: number;
  latitude: number;
};

export type OpenRouteLocationSuggestion = {
  label: string;
  longitude: number;
  latitude: number;
};

export type OpenRouteRouteSummary = {
  distanceMeters: number;
  durationSeconds: number;
};

// ---------------------------------------------------------------------------
// Geocoding API
// https://developers.google.com/maps/documentation/geocoding/requests-geocoding
// ---------------------------------------------------------------------------

type GeocodeResult = {
  results: Array<{
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
  }>;
  status: string;
  error_message?: string;
};

export const geocodeOpenRouteLocation = async ({
  apiKey,
  text,
}: {
  apiKey: string;
  baseUrl?: string; // ignored, kept for caller compatibility
  text: string;
}): Promise<OpenRouteResolvedLocation> => {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", text);
  url.searchParams.set("region", "it");
  url.searchParams.set("language", "it");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Google Geocoding API non disponibile (HTTP ${response.status})`,
    );
  }

  const payload: GeocodeResult = await response.json();

  if (payload.status !== "OK" || !payload.results?.length) {
    if (payload.status === "ZERO_RESULTS") {
      throw new Error(`Nessun risultato di geocoding per "${text}".`);
    }
    throw new Error(
      `Google Geocoding API errore: ${payload.error_message ?? payload.status}`,
    );
  }

  const result = payload.results[0];
  return {
    query: text,
    label: result.formatted_address,
    longitude: result.geometry.location.lng,
    latitude: result.geometry.location.lat,
  };
};

// ---------------------------------------------------------------------------
// Places Autocomplete (New)
// https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
// ---------------------------------------------------------------------------

type PlacesAutocompleteSuggestion = {
  placePrediction?: {
    text: { text: string };
    placeId: string;
  };
};

type PlacesAutocompleteResponse = {
  suggestions?: PlacesAutocompleteSuggestion[];
};

export const searchOpenRouteLocations = async ({
  apiKey,
  text,
  size = 5,
}: {
  apiKey: string;
  baseUrl?: string; // ignored
  text: string;
  size?: number;
}): Promise<OpenRouteLocationSuggestion[]> => {
  // Step 1: get autocomplete suggestions
  const autocompleteResponse = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        input: text,
        includedRegionCodes: ["it"],
        languageCode: "it",
      }),
    },
  );

  if (!autocompleteResponse.ok) {
    throw new Error(
      `Google Places Autocomplete non disponibile (HTTP ${autocompleteResponse.status})`,
    );
  }

  const autocompletePayload: PlacesAutocompleteResponse =
    await autocompleteResponse.json();

  const suggestions = (autocompletePayload.suggestions ?? [])
    .filter((s) => s.placePrediction)
    .slice(0, Math.max(1, Math.min(10, Math.trunc(size) || 5)));

  if (!suggestions.length) {
    return [];
  }

  // Step 2: geocode each suggestion to get coordinates
  const results = await Promise.all(
    suggestions.map(async (suggestion) => {
      const label = suggestion.placePrediction!.text.text;
      try {
        const resolved = await geocodeOpenRouteLocation({
          apiKey,
          text: label,
        });
        return {
          label: resolved.label,
          longitude: resolved.longitude,
          latitude: resolved.latitude,
        };
      } catch {
        return null;
      }
    }),
  );

  return results.filter(
    (r): r is OpenRouteLocationSuggestion => r !== null,
  );
};

// ---------------------------------------------------------------------------
// Routes API v2
// https://developers.google.com/maps/documentation/routes/compute-route-directions
// ---------------------------------------------------------------------------

type RoutesApiResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string; // e.g. "1234s"
  }>;
  error?: { message: string; status: string };
};

export const getOpenRouteDrivingSummary = async ({
  apiKey,
  coordinates,
}: {
  apiKey: string;
  baseUrl?: string; // ignored
  coordinates: [[number, number], [number, number]];
}): Promise<OpenRouteRouteSummary> => {
  // coordinates are [lng, lat] pairs (ORS convention) — Routes API wants lat/lng
  const [originLng, originLat] = coordinates[0];
  const [destLng, destLat] = coordinates[1];

  const response = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: { latitude: originLat, longitude: originLng },
          },
        },
        destination: {
          location: {
            latLng: { latitude: destLat, longitude: destLng },
          },
        },
        travelMode: "DRIVE",
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Google Routes API non disponibile (HTTP ${response.status}): ${errorBody}`,
    );
  }

  const payload: RoutesApiResponse = await response.json();

  if (payload.error) {
    throw new Error(
      `Google Routes API errore: ${payload.error.message ?? payload.error.status}`,
    );
  }

  const route = payload.routes?.[0];
  if (!route || typeof route.distanceMeters !== "number" || !route.duration) {
    throw new Error("Google Routes API non ha restituito una tratta valida.");
  }

  // duration is a string like "1234s" — extract seconds
  const durationSeconds = parseInt(route.duration.replace("s", ""), 10);

  return {
    distanceMeters: route.distanceMeters,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
  };
};
