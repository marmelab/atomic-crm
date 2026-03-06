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

const buildUrl = (baseUrl: string, path: string) =>
  new URL(path.replace(/^\//, ""), `${baseUrl.replace(/\/+$/, "")}/`);

const getErrorMessage = async (response: Response) => {
  try {
    const payload = await response.json();
    return (
      payload?.error?.message ??
      payload?.error ??
      payload?.message ??
      response.statusText
    );
  } catch {
    return response.statusText;
  }
};

// Geographic focus on Sicily (Enna province center) to bias results toward the
// user's operating area.  boundary.country restricts to Italy entirely.
const SICILY_FOCUS = { lat: "37.56", lon: "14.27" } as const;

export const geocodeOpenRouteLocation = async ({
  apiKey,
  baseUrl,
  text,
}: {
  apiKey: string;
  baseUrl: string;
  text: string;
}): Promise<OpenRouteResolvedLocation> => {
  const url = buildUrl(baseUrl, "geocode/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("text", text);
  url.searchParams.set("size", "1");
  url.searchParams.set("boundary.country", "IT");
  url.searchParams.set("focus.point.lat", SICILY_FOCUS.lat);
  url.searchParams.set("focus.point.lon", SICILY_FOCUS.lon);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `openrouteservice geocoding non disponibile: ${await getErrorMessage(response)}`,
    );
  }

  const payload = await response.json();
  const firstFeature = Array.isArray(payload?.features)
    ? payload.features[0]
    : null;
  const coordinates = Array.isArray(firstFeature?.geometry?.coordinates)
    ? firstFeature.geometry.coordinates
    : null;

  if (
    !firstFeature ||
    !coordinates ||
    typeof coordinates[0] !== "number" ||
    typeof coordinates[1] !== "number"
  ) {
    throw new Error(`Nessun risultato di geocoding per "${text}".`);
  }

  return {
    query: text,
    label:
      typeof firstFeature?.properties?.label === "string"
        ? firstFeature.properties.label
        : text,
    longitude: coordinates[0],
    latitude: coordinates[1],
  };
};

export const searchOpenRouteLocations = async ({
  apiKey,
  baseUrl,
  text,
  size = 5,
}: {
  apiKey: string;
  baseUrl: string;
  text: string;
  size?: number;
}): Promise<OpenRouteLocationSuggestion[]> => {
  const url = buildUrl(baseUrl, "geocode/autocomplete");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("text", text);
  url.searchParams.set(
    "size",
    String(Math.max(1, Math.min(10, Math.trunc(size) || 5))),
  );
  url.searchParams.set("boundary.country", "IT");
  url.searchParams.set("focus.point.lat", SICILY_FOCUS.lat);
  url.searchParams.set("focus.point.lon", SICILY_FOCUS.lon);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `openrouteservice autocomplete non disponibile: ${await getErrorMessage(response)}`,
    );
  }

  const payload = await response.json();
  const features = Array.isArray(payload?.features) ? payload.features : [];
  const suggestions = features
    .map((feature): OpenRouteLocationSuggestion | null => {
      const coordinates = Array.isArray(feature?.geometry?.coordinates)
        ? feature.geometry.coordinates
        : null;

      if (
        !coordinates ||
        typeof coordinates[0] !== "number" ||
        typeof coordinates[1] !== "number"
      ) {
        return null;
      }

      return {
        label:
          typeof feature?.properties?.label === "string"
            ? feature.properties.label
            : text,
        longitude: coordinates[0],
        latitude: coordinates[1],
      };
    })
    .filter(
      (suggestion): suggestion is OpenRouteLocationSuggestion =>
        suggestion !== null,
    );

  return suggestions;
};

export const getOpenRouteDrivingSummary = async ({
  apiKey,
  baseUrl,
  coordinates,
}: {
  apiKey: string;
  baseUrl: string;
  coordinates: [[number, number], [number, number]];
}): Promise<OpenRouteRouteSummary> => {
  const response = await fetch(buildUrl(baseUrl, "v2/directions/driving-car"), {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      coordinates,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `openrouteservice routing non disponibile: ${await getErrorMessage(response)}`,
    );
  }

  const payload = await response.json();
  const summary = payload?.routes?.[0]?.summary;

  if (
    !summary ||
    typeof summary.distance !== "number" ||
    typeof summary.duration !== "number"
  ) {
    throw new Error("openrouteservice non ha restituito una tratta valida.");
  }

  return {
    distanceMeters: summary.distance,
    durationSeconds: summary.duration,
  };
};
