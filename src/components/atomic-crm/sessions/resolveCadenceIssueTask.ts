import type { DataProvider, Identifier } from "ra-core";

import { resolveDefaultTaskSalesId } from "../sales-calls/resolveDefaultTaskSalesId";
import type { Task } from "../types";

const RESOLVE_CADENCE_ISSUE_TASK_TYPE = "resolve_client_session_cadence";

// resolveSalesCallTask.ts's own find/complete shape, deterministic by
// cadence_issue_id (always set at creation — no legacy-Task fallback
// needed, unlike sales_call_id's). Exception state-machine correction: a
// resolve_client_session_cadence Task is no longer ONLY ever created by
// the calendar sync's own detection pass — see ensureCadenceIssueTaskOpen
// below, which the app itself now also calls synchronously (a No-show
// that breaks fulfillment must surface immediately, not wait for the
// next 6-hourly cron pass).
export const findAnyResolveCadenceIssueTask = async (
  dataProvider: DataProvider,
  cadenceIssueId: Identifier,
): Promise<Task | null> => {
  const { data } = await dataProvider.getList<Task>("tasks", {
    filter: {
      cadence_issue_id: cadenceIssueId,
      type: RESOLVE_CADENCE_ISSUE_TASK_TYPE,
    },
    pagination: { page: 1, perPage: 5 },
    sort: { field: "id", order: "ASC" },
  });
  return data[0] ?? null;
};

export const findPendingResolveCadenceIssueTask = async (
  dataProvider: DataProvider,
  cadenceIssueId: Identifier,
): Promise<Task | null> => {
  const task = await findAnyResolveCadenceIssueTask(
    dataProvider,
    cadenceIssueId,
  );
  return task && !task.done_date ? task : null;
};

export const completeResolveCadenceIssueTask = async (
  dataProvider: DataProvider,
  cadenceIssueId: Identifier,
  completedAt: string,
): Promise<void> => {
  const task = await findPendingResolveCadenceIssueTask(
    dataProvider,
    cadenceIssueId,
  );
  if (!task) return;
  await dataProvider.update("tasks", {
    id: task.id,
    data: { done_date: completedAt, status: "completed" },
    previousData: task,
  });
};

// The app-side create-or-reopen half — mirrors ensureResolveSalesCallTask.ts's
// own shape. Called whenever ensureCadenceIssueOpen.ts creates or reopens
// a client_session_cadence_issues row: a done Task for the SAME issue is
// reopened in place (never a second Task for one issue); no Task yet
// means one is created fresh.
export const ensureCadenceIssueTaskOpen = async (
  dataProvider: DataProvider,
  {
    cadenceIssueId,
    contactId,
    contactName,
    weekLabel,
  }: {
    cadenceIssueId: Identifier;
    contactId: Identifier;
    contactName: string;
    weekLabel: string;
  },
): Promise<void> => {
  const existing = await findAnyResolveCadenceIssueTask(
    dataProvider,
    cadenceIssueId,
  );
  if (existing) {
    if (!existing.done_date) return;
    await dataProvider.update("tasks", {
      id: existing.id,
      data: { done_date: null, status: "pending" },
      previousData: existing,
    });
    return;
  }

  const salesId = await resolveDefaultTaskSalesId(dataProvider);
  await dataProvider.create("tasks", {
    data: {
      contact_id: contactId,
      type: RESOLVE_CADENCE_ISSUE_TASK_TYPE,
      text: `${contactName} · No session booked for week of ${weekLabel}`,
      due_date: new Date().toISOString(),
      status: "pending",
      cadence_issue_id: cadenceIssueId,
      ...(salesId != null ? { sales_id: salesId } : {}),
    },
  });
};
