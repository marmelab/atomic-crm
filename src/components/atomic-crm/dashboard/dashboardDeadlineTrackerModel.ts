import { toBusinessISODate } from "@/lib/dateTimezone";

import type { ClientTask, Payment } from "../types";

const compareDateValues = (left?: string | null, right?: string | null) => {
  const leftIso = left ? toBusinessISODate(left) : null;
  const rightIso = right ? toBusinessISODate(right) : null;

  if (!leftIso && !rightIso) return 0;
  if (!leftIso) return 1;
  if (!rightIso) return -1;
  return leftIso.localeCompare(rightIso);
};

export const getOverduePaymentsForDeadlineTracker = ({
  payments,
  todayIso,
}: {
  payments: Payment[];
  todayIso: string;
}) =>
  payments
    .filter((payment) => {
      if (!payment.payment_date) {
        return payment.status === "scaduto";
      }
      const paymentDateIso = toBusinessISODate(payment.payment_date);
      if (!paymentDateIso) {
        return payment.status === "scaduto";
      }
      return payment.status === "scaduto" || paymentDateIso < todayIso;
    })
    .sort((left, right) =>
      compareDateValues(
        left.payment_date ?? left.created_at,
        right.payment_date ?? right.created_at,
      ),
    );

export const getDueSoonPaymentsForDeadlineTracker = ({
  payments,
  todayIso,
  limitDateIso,
}: {
  payments: Payment[];
  todayIso: string;
  limitDateIso: string;
}) =>
  payments
    .filter((payment) => {
      if (payment.status !== "in_attesa" || !payment.payment_date) {
        return false;
      }
      const paymentDateIso = toBusinessISODate(payment.payment_date);
      if (!paymentDateIso) {
        return false;
      }
      return paymentDateIso >= todayIso && paymentDateIso <= limitDateIso;
    })
    .sort((left, right) =>
      compareDateValues(
        left.payment_date ?? left.created_at,
        right.payment_date ?? right.created_at,
      ),
    );

export const getUpcomingTasksForDeadlineTracker = ({
  tasks,
  todayIso,
  limitDateIso,
}: {
  tasks: ClientTask[];
  todayIso: string;
  limitDateIso: string;
}) =>
  tasks
    .filter((task) => {
      if (task.done_date) return false;
      const dueDateIso = toBusinessISODate(task.due_date);
      if (!dueDateIso) return false;
      return dueDateIso >= todayIso && dueDateIso <= limitDateIso;
    })
    .sort((left, right) => compareDateValues(left.due_date, right.due_date));

export const buildDashboardDeadlineTrackerComputed = ({
  limitDateIso,
  openTasks,
  pendingPayments,
  todayIso,
  unansweredQuotesCount,
  upcomingServicesCount,
}: {
  limitDateIso: string;
  openTasks: ClientTask[];
  pendingPayments: Payment[];
  todayIso: string;
  unansweredQuotesCount: number;
  upcomingServicesCount: number;
}) => {
  const overduePaymentsAll = getOverduePaymentsForDeadlineTracker({
    payments: pendingPayments,
    todayIso,
  });
  const dueSoonPaymentsAll = getDueSoonPaymentsForDeadlineTracker({
    payments: pendingPayments,
    todayIso,
    limitDateIso,
  });
  const upcomingTasksAll = getUpcomingTasksForDeadlineTracker({
    tasks: openTasks,
    todayIso,
    limitDateIso,
  });
  const overdueCount = overduePaymentsAll.length;
  const dueSoonCount = dueSoonPaymentsAll.length;
  const otherCount =
    upcomingTasksAll.length + upcomingServicesCount + unansweredQuotesCount;

  return {
    dueSoonCount,
    dueSoonPayments: dueSoonPaymentsAll.slice(0, 6),
    dueSoonTotal: dueSoonPaymentsAll.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0,
    ),
    otherCount,
    overdueCount,
    overduePayments: overduePaymentsAll.slice(0, 6),
    overdueTotal: overduePaymentsAll.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0,
    ),
    totalItems: overdueCount + dueSoonCount + otherCount,
    upcomingTasks: upcomingTasksAll.slice(0, 8),
  };
};
