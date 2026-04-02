import { useCallback, useMemo } from "react";
import { useCreate, useDelete, useGetList } from "ra-core";

import { startOfBusinessDayISOString } from "@/lib/dateTimezone";

import type { ClientTask } from "../types";
import { fiscalTaskTypes } from "../root/defaultConfiguration";
import type { FiscalDeadline, FiscalScheduleItem } from "./fiscalModelTypes";

export type FiscalTaskDraft = {
  key: string;
  payload: Pick<
    ClientTask,
    "text" | "type" | "due_date" | "done_date" | "client_id"
  >;
};

export const buildFiscalTaskType = (
  component: FiscalScheduleItem["component"],
): string => {
  if (component.startsWith("inps")) return "inps";
  if (component === "bollo") return "bollo";
  if (component === "dichiarazione") return "dichiarazione";
  return "f24";
};

export const buildFiscalTaskIdentity = ({
  date,
  component,
  competenceYear,
}: {
  date: string;
  component: FiscalScheduleItem["component"];
  competenceYear: number | null;
}) => [date, component, competenceYear ?? "none"].join("::");

export const buildFiscalTaskDrafts = (
  deadlines: FiscalDeadline[],
): FiscalTaskDraft[] => {
  const drafts: FiscalTaskDraft[] = [];
  const seen = new Set<string>();

  for (const deadline of deadlines) {
    for (const item of deadline.items) {
      const key = buildFiscalTaskIdentity({
        date: deadline.date,
        component: item.component,
        competenceYear: item.competenceYear,
      });

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);

      const amountNote =
        item.amount > 0
          ? ` (${item.amount.toLocaleString("it-IT", {
              style: "currency",
              currency: "EUR",
            })})`
          : "";

      drafts.push({
        key,
        payload: {
          text: `${item.description}${amountNote}`,
          type: buildFiscalTaskType(item.component),
          due_date: startOfBusinessDayISOString(deadline.date) ?? deadline.date,
          done_date: null,
          client_id: null,
        },
      });
    }
  }

  return drafts;
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
    const nextDrafts = buildFiscalTaskDrafts(deadlines);

    // Delete existing fiscal tasks for this year range
    for (const task of existingFiscalTasks) {
      await deleteOne("client_tasks", {
        id: task.id,
        previousData: task,
      });
    }

    // Create one task per structured fiscal identity.
    for (const draft of nextDrafts) {
      await create("client_tasks", {
        data: draft.payload,
      });
    }

    // Refresh the list so the UI updates
    await refetch();
  }, [deadlines, existingFiscalTasks, create, deleteOne, refetch]);

  return {
    generate,
    existingCount: existingFiscalTasks.length,
  };
};
