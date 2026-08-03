import { useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useGetIdentity, useNotify } from "ra-core";
import { useCallback } from "react";

import type { CrmDataProvider } from "../providers/types";
import type { UserPreferences } from "../types";
import { PREFERENCES_QUERY_KEY } from "./preferences";

let pendingWrites: Promise<unknown> = Promise.resolve();
let generation = 0;

export const resetPendingPreferenceWrites = () => {
  generation += 1;
  pendingWrites = Promise.resolve();
};

export const usePersistPreference = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
  const queryClient = useQueryClient();
  const notify = useNotify();

  return useCallback(
    (patch: Partial<UserPreferences>) => {
      const queryKey = [PREFERENCES_QUERY_KEY, identity?.id];
      const previous = queryClient.getQueryData<UserPreferences>(queryKey);
      queryClient.setQueryData(queryKey, { ...previous, ...patch });

      const enqueuedAt = generation;
      pendingWrites = pendingWrites
        .catch(() => {})
        .then(() =>
          enqueuedAt === generation
            ? dataProvider.updatePreferences(patch)
            : undefined,
        )
        .then((preferences) => {
          if (preferences === undefined) return;
          queryClient.setQueryData(queryKey, preferences);
        })
        .catch(() => {
          if (previous === undefined) {
            queryClient.removeQueries({ queryKey, exact: true });
          } else {
            queryClient.setQueryData(queryKey, previous);
          }
          notify("crm.preferences.update_error", {
            type: "error",
            messageArgs: { _: "Could not save your preferences" },
          });
        });
    },
    [dataProvider, identity?.id, queryClient, notify],
  );
};
