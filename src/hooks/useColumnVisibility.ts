import { useCallback } from "react";
import { useDataProvider } from "ra-core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@/components/atomic-crm/misc/columnDefinitions";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/supabase/dataProvider";

/**
 * Hook for managing column visibility per resource.
 * Persists preferences in the `settings` DB table.
 *
 * Returns:
 * - `columns` — full column definitions
 * - `visibleKeys` — currently visible column keys
 * - `isVisible(key)` — check if a column is visible
 * - `toggleColumn(key)` — toggle a column on/off
 * - `cv(key, baseClass?)` — className helper: returns baseClass when visible, "hidden" when not
 */
export function useColumnVisibility(resource: string, columns: ColumnDef[]) {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const queryKey = ["column-preferences", resource];

  const allKeys = columns.map((c) => c.key);

  const { data: savedColumns } = useQuery({
    queryKey,
    queryFn: () => dataProvider.getColumnPreferences(resource),
    staleTime: Infinity,
  });

  const visibleKeys = savedColumns ?? allKeys;

  const mutation = useMutation({
    mutationFn: (newVisible: string[]) =>
      dataProvider.setColumnPreferences(resource, newVisible),
    onMutate: async (newVisible) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, newVisible);
    },
  });

  const toggleColumn = useCallback(
    (key: string) => {
      const newVisible = visibleKeys.includes(key)
        ? visibleKeys.filter((k) => k !== key)
        : [...visibleKeys, key];
      mutation.mutate(newVisible);
    },
    [visibleKeys, mutation],
  );

  const isVisible = useCallback(
    (key: string) => visibleKeys.includes(key),
    [visibleKeys],
  );

  const cv = useCallback(
    (key: string, baseClass?: string) =>
      isVisible(key) ? baseClass : "hidden",
    [isVisible],
  );

  return { columns, visibleKeys, isVisible, toggleColumn, cv };
}
