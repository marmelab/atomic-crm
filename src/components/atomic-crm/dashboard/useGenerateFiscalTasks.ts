import { useCallback, useMemo } from "react";
import { useCreate, useDelete, useGetList } from "ra-core";

import { startOfBusinessDayISOString } from "@/lib/dateTimezone";

import type { ClientTask } from "../types";
import { fiscalTaskTypes } from "../root/defaultConfiguration";
import type { FiscalDeadline } from "./fiscalModelTypes";

/** Maps a deadline item description to the appropriate fiscal task type. */
const inferTaskType = (description: string): string => {
  const lower = description.toLowerCase();
  if (lower.includes("inps")) return "inps";
  if (lower.includes("imposta") || lower.includes("f24")) return "f24";
  if (lower.includes("bollo")) return "bollo";
  if (lower.includes("dichiarazione") || lower.includes("redditi"))
    return "dichiarazione";
  return "f24"; // fallback for fiscal items
};

/**
 * Hook to generate fiscal deadline tasks from the fiscal model.
 *
 * Returns the count of existing fiscal tasks for the year so the caller
 * can show a confirmation dialog before regenerating.
 */
export const useGenerateFiscalTasks = ({
  deadlines,
  year,
}: {
  deadlines: FiscalDeadline[];
  year: number;
}) => {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-03-31`; // include Q4 bollo (feb next year)

  const { data: existingTasks = [], refetch } = useGetList<ClientTask>(
    "client_tasks",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "due_date", order: "ASC" },
      filter: {
        "due_date@gte": yearStart,
        "due_date@lte": yearEnd,
      },
    },
  );

  const existingFiscalTasks = useMemo(
    () => existingTasks.filter((t) => fiscalTaskTypes.includes(t.type)),
    [existingTasks],
  );

  const [create] = useCreate();
  const [deleteOne] = useDelete();

  const generate = useCallback(async () => {
    // Delete existing fiscal tasks for this year range
    for (const task of existingFiscalTasks) {
      await deleteOne("client_tasks", {
        id: task.id,
        previousData: task,
      });
    }

    // Create a task for each deadline item
    for (const deadline of deadlines) {
      for (const item of deadline.items) {
        const taskType = inferTaskType(item.description);
        const amountNote =
          item.amount > 0
            ? ` (${item.amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" })})`
            : "";

        await create("client_tasks", {
          data: {
            text: `${item.description}${amountNote}`,
            type: taskType,
            due_date:
              startOfBusinessDayISOString(deadline.date) ?? deadline.date,
            done_date: null,
            client_id: null,
          },
        });
      }
    }

    // Refresh the list so the UI updates
    await refetch();
  }, [deadlines, existingFiscalTasks, create, deleteOne, refetch]);

  return {
    generate,
    existingCount: existingFiscalTasks.length,
  };
};
