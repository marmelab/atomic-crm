import type { Identifier } from "ra-core";
import { getSupabaseClient } from "../providers/supabase/supabase";

export const useTaskAssignmentNotify = () => {
  return async (
    taskId: Identifier,
    newSalesId: Identifier | null | undefined,
    prevSalesId?: Identifier | null,
  ) => {
    if (!newSalesId) return;
    if (prevSalesId !== undefined && newSalesId === prevSalesId) return;

    try {
      const { error } = await getSupabaseClient().functions.invoke(
        "notify_task_assigned",
        { method: "POST", body: { task_id: taskId } },
      );
      if (error) console.warn("Task assignment notify failed:", error);
    } catch (e) {
      console.warn("Task assignment notify error:", e);
    }
  };
};
