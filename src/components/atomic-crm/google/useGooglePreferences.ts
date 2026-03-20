import { useCallback } from "react";
import { useDataProvider, useNotify } from "ra-core";
import type { CrmDataProvider } from "../providers/types";
import type { GooglePreferences } from "./types";
import {
  useGoogleConnectionStatus,
  useInvalidateGoogleStatus,
} from "./useGoogleConnectionStatus";

export function useGooglePreferences() {
  const { data: status } = useGoogleConnectionStatus();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const invalidate = useInvalidateGoogleStatus();

  const updatePreferences = useCallback(
    async (preferences: GooglePreferences) => {
      try {
        await dataProvider.updateGooglePreferences(preferences);
        invalidate();
      } catch {
        notify("Erreur lors de la mise à jour des préférences", {
          type: "error",
        });
      }
    },
    [dataProvider, notify, invalidate],
  );

  return {
    preferences: status?.preferences,
    updatePreferences,
  };
}
