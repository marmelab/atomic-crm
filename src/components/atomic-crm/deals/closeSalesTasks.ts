import type { DataProvider, Identifier } from "ra-core";

import type { Task } from "../types";

// A sales decision answers the tasks that were waiting for it.
//
// Gil Lelli's follow-up is the case: "Follow up with Gil Lelli, due Sep
// 22" exists precisely because nobody knew yet what he would decide. Once
// Leif records yes or removes Gil from the pipeline, that task is not
// outstanding work any more, and leaving it on the Dashboard trains him to
// ignore the Dashboard.
//
// Only the task types that genuinely ask "what did they decide?" are
// closed. A sales_call task for a booking that still exists is untouched,
// because a decision about the Opportunity is not a decision about
// whether the call happens.
const DECISION_ANSWERING_TYPES: ReadonlySet<string> = new Set([
  "follow_up",
  "nurture_follow_up",
  "sales_call_cancelled",
]);

export const closeSalesDecisionTasks = async (
  dataProvider: DataProvider,
  contactId: Identifier,
  completedAt: string,
): Promise<number> => {
  const { data } = await dataProvider.getList<Task>("tasks", {
    filter: { contact_id: contactId },
    pagination: { page: 1, perPage: 100 },
    sort: { field: "id", order: "ASC" },
  });

  const answered = (data ?? []).filter(
    (task) =>
      !task.done_date &&
      task.type != null &&
      DECISION_ANSWERING_TYPES.has(task.type),
  );

  for (const task of answered) {
    await dataProvider.update<Task>("tasks", {
      id: task.id,
      data: { done_date: completedAt, status: "completed" },
      previousData: task,
    });
  }

  return answered.length;
};
