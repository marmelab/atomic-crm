import type {
  TravelRouteEstimate,
  TravelRouteEstimateRequest,
  TravelRouteLocationSuggestRequest,
  TravelRouteLocationSuggestion,
} from "@/lib/travelRouteEstimate";
import { extractEdgeFunctionErrorMessage } from "./edgeFunctionError";
import type { InvokeEdgeFunction } from "./dataProviderTypes";

export const buildTravelProviderMethods = (deps: {
  invokeEdgeFunction: InvokeEdgeFunction;
}) => ({
  async estimateTravelRoute(
    request: TravelRouteEstimateRequest,
  ): Promise<TravelRouteEstimate> {
    const { data, error } = await deps.invokeEdgeFunction<{
      data: TravelRouteEstimate;
    }>("travel_route_estimate", {
      method: "POST",
      body: request,
    });

    if (!data || error) {
      console.error("estimateTravelRoute.error", error);
      throw new Error(
        await extractEdgeFunctionErrorMessage(
          error,
          "Impossibile calcolare la tratta richiesta",
        ),
      );
    }

    return data.data;
  },
  async suggestTravelLocations(
    request: TravelRouteLocationSuggestRequest,
  ): Promise<TravelRouteLocationSuggestion[]> {
    const { data, error } = await deps.invokeEdgeFunction<{
      data: TravelRouteLocationSuggestion[];
    }>("travel_location_suggest", {
      method: "POST",
      body: request,
    });

    if (!data || error) {
      console.error("suggestTravelLocations.error", error);
      throw new Error(
        await extractEdgeFunctionErrorMessage(
          error,
          "Impossibile cercare i luoghi richiesti",
        ),
      );
    }

    return data.data;
  },
});
