import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";
import type { CrmDataProvider } from "../providers/types";
import type { GoogleConnectionStatus } from "./types";
import { defaultGooglePreferences } from "./types";

const QUERY_KEY = ["google-connection-status"];

const disconnectedStatus: GoogleConnectionStatus = {
  connected: false,
  email: null,
  scopes: [],
  preferences: defaultGooglePreferences,
};

export function useGoogleConnectionStatus() {
  const dataProvider = useDataProvider<CrmDataProvider>();

  return useQuery<GoogleConnectionStatus>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      try {
        return await dataProvider.getGoogleStatus();
      } catch {
        return disconnectedStatus;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 min
    retry: false,
  });
}

export function useInvalidateGoogleStatus() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });
}
