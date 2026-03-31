import { describe, expect, it } from "vitest";

import type { ClientTask, Payment } from "../types";
import {
  getDueSoonPaymentsForDeadlineTracker,
  getOverduePaymentsForDeadlineTracker,
  getUpcomingTasksForDeadlineTracker,
} from "./DashboardDeadlineTracker";

const todayIso = "2026-03-01";
const limitDateIso = "2026-03-08";

const buildPayment = (
  id: string,
  overrides: Partial<Payment> = {},
): Payment => ({
  id,
  client_id: "client-1",
  payment_type: "saldo",
  amount: 100,
  status: "in_attesa",
  payment_date: "2026-03-01T12:00:00.000Z",
  created_at: "2026-02-01T12:00:00.000Z",
  ...overrides,
});

const buildTask = (
  id: string,
  overrides: Partial<ClientTask> = {},
): ClientTask => ({
  id,
  client_id: "client-1",
  text: `Task ${id}`,
  type: "follow-up",
  due_date: "2026-03-01T12:00:00.000Z",
  all_day: true,
  done_date: null,
  created_at: "2026-02-01T12:00:00.000Z",
  updated_at: "2026-02-01T12:00:00.000Z",
  ...overrides,
});

describe("DashboardDeadlineTracker helpers", () => {
  it("returns overdue payments sorted by oldest date first", () => {
    const overdue = getOverduePaymentsForDeadlineTracker({
      todayIso,
      payments: [
        buildPayment("payment-new", {
          status: "scaduto",
          payment_date: "2026-02-25T12:00:00.000Z",
        }),
        buildPayment("payment-old", {
          status: "in_attesa",
          payment_date: "2026-02-20T12:00:00.000Z",
        }),
        buildPayment("payment-future", {
          status: "in_attesa",
          payment_date: "2026-03-10T12:00:00.000Z",
        }),
      ],
    });

    expect(overdue.map((payment) => payment.id)).toEqual([
      "payment-old",
      "payment-new",
    ]);
  });

  it("returns only in-attesa payments due within seven days", () => {
    const dueSoon = getDueSoonPaymentsForDeadlineTracker({
      todayIso,
      limitDateIso,
      payments: [
        buildPayment("payment-due-3", {
          status: "in_attesa",
          payment_date: "2026-03-04T12:00:00.000Z",
        }),
        buildPayment("payment-due-7", {
          status: "in_attesa",
          payment_date: "2026-03-08T12:00:00.000Z",
        }),
        buildPayment("payment-due-8", {
          status: "in_attesa",
          payment_date: "2026-03-09T12:00:00.000Z",
        }),
        buildPayment("payment-scaduto", {
          status: "scaduto",
          payment_date: "2026-03-04T12:00:00.000Z",
        }),
      ],
    });

    expect(dueSoon.map((payment) => payment.id)).toEqual([
      "payment-due-3",
      "payment-due-7",
    ]);
  });

  it("returns only non-completed tasks due within seven days", () => {
    const tasks = getUpcomingTasksForDeadlineTracker({
      todayIso,
      limitDateIso,
      tasks: [
        buildTask("task-early", {
          due_date: "2026-03-02T12:00:00.000Z",
        }),
        buildTask("task-late", {
          due_date: "2026-03-06T12:00:00.000Z",
        }),
        buildTask("task-overdue", {
          due_date: "2026-02-28T12:00:00.000Z",
        }),
        buildTask("task-done", {
          due_date: "2026-03-05T12:00:00.000Z",
          done_date: "2026-03-01T14:00:00.000Z",
        }),
      ],
    });

    expect(tasks.map((task) => task.id)).toEqual(["task-early", "task-late"]);
  });

  it("returns empty arrays for empty inputs", () => {
    expect(
      getOverduePaymentsForDeadlineTracker({
        payments: [],
        todayIso,
      }),
    ).toEqual([]);
    expect(
      getDueSoonPaymentsForDeadlineTracker({
        payments: [],
        todayIso,
        limitDateIso,
      }),
    ).toEqual([]);
    expect(
      getUpcomingTasksForDeadlineTracker({
        tasks: [],
        todayIso,
        limitDateIso,
      }),
    ).toEqual([]);
  });
});
