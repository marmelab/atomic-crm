import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";

/**
 * Subscribes to Supabase Realtime postgres_changes on the given tables
 * and invalidates the matching React Query cache entries on every change.
 *
 * ra-core query keys follow the pattern [resource, 'getList', ...params],
 * so invalidating with { queryKey: [table] } and exact:false covers all
 * queries for that resource.
 */
export const useRealtimeInvalidation = (
  tables: string[],
  extraQueryKeys?: string[][],
) => {
  const queryClient = useQueryClient();
  const tablesRef = useRef(tables);
  tablesRef.current = tables;
  const extraRef = useRef(extraQueryKeys);
  extraRef.current = extraQueryKeys;

  useEffect(() => {
    if (tablesRef.current.length === 0) return;

    const channelName = `realtime-${tablesRef.current.join("-")}`;
    const channel = supabase.channel(channelName);

    for (const table of tablesRef.current) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          queryClient.invalidateQueries({ queryKey: [table] });
          if (extraRef.current) {
            for (const key of extraRef.current) {
              queryClient.invalidateQueries({ queryKey: key });
            }
          }
        },
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};
