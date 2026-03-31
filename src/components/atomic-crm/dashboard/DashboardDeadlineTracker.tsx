import { addDaysToISODate, todayISODate } from "@/lib/dateTimezone";
import { useMemo } from "react";
import { useCreatePath, useGetList, useUpdate } from "ra-core";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { Client, ClientTask, Payment } from "../types";
import { DashboardDeadlineTrackerContent } from "./DashboardDeadlineTrackerContent";
import { type DashboardAlerts } from "./dashboardModel";
import { buildDashboardDeadlineTrackerComputed } from "./dashboardDeadlineTrackerModel";

const LARGE_PAGE = { page: 1, perPage: 1000 };

const useDeadlineTrackerCollections = () => {
  const todayIso = todayISODate();
  const limitDateIso = addDaysToISODate(todayIso, 7);
  const createPath = useCreatePath();

  const { data: clients = [], isPending: isPendingClients } =
    useGetList<Client>("clients", {
      pagination: LARGE_PAGE,
      sort: { field: "name", order: "ASC" },
      filter: {},
    });

  const { data: pendingPayments = [], isPending: isPendingPayments } =
    useGetList<Payment>("payments", {
      pagination: LARGE_PAGE,
      sort: { field: "payment_date", order: "ASC" },
      filter: {
        "status@neq": "ricevuto",
        "payment_type@neq": "rimborso",
      },
    });

  const { data: openTasks = [], isPending: isPendingTasks } =
    useGetList<ClientTask>("client_tasks", {
      pagination: LARGE_PAGE,
      sort: { field: "due_date", order: "ASC" },
      filter: { "done_date@is": null },
    });

  const clientsById = useMemo(
    () => new Map(clients.map((client) => [String(client.id), client])),
    [clients],
  );

  return {
    clientsById,
    createPath,
    isPendingClients,
    isPendingPayments,
    isPendingTasks,
    limitDateIso,
    openTasks,
    pendingPayments,
    todayIso,
  };
};

const useDeadlineTrackerActions = (todayIso: string) => {
  const [update, { isPending: isUpdating }] = useUpdate();

  const markPaymentAsReceived = (payment: Payment) => {
    update("payments", {
      id: payment.id,
      data: {
        status: "ricevuto",
        payment_date: payment.payment_date ?? todayIso,
      },
      previousData: payment,
    });
  };

  const markTaskAsDone = (task: ClientTask) => {
    update("client_tasks", {
      id: task.id,
      data: { done_date: new Date().toISOString() },
      previousData: task,
    });
  };

  return { isUpdating, markPaymentAsReceived, markTaskAsDone };
};

const useDashboardDeadlineTrackerData = ({
  alerts,
}: {
  alerts: DashboardAlerts;
}) => {
  const {
    clientsById,
    createPath,
    isPendingClients,
    isPendingPayments,
    isPendingTasks,
    limitDateIso,
    openTasks,
    pendingPayments,
    todayIso,
  } = useDeadlineTrackerCollections();
  const { isUpdating, markPaymentAsReceived, markTaskAsDone } =
    useDeadlineTrackerActions(todayIso);

  const computed = useMemo(() => buildDashboardDeadlineTrackerComputed({
    limitDateIso,
    openTasks,
    pendingPayments,
    todayIso,
    unansweredQuotesCount: alerts.unansweredQuotes.length,
    upcomingServicesCount: alerts.upcomingServices.length,
  }), [
    alerts.unansweredQuotes.length,
    alerts.upcomingServices.length,
    limitDateIso,
    openTasks,
    pendingPayments,
    todayIso,
  ]);

  return {
    alerts,
    clientsById,
    createPath,
    isPendingClients,
    isPendingPayments,
    isPendingTasks,
    isUpdating,
    markPaymentAsReceived,
    markTaskAsDone,
    todayIso,
    ...computed,
  };
};

export const DashboardDeadlineTracker = ({
  alerts,
}: {
  alerts: DashboardAlerts;
}) => {
  const tracker = useDashboardDeadlineTrackerData({ alerts });

  if (
    tracker.isPendingClients ||
    tracker.isPendingPayments ||
    tracker.isPendingTasks
  ) {
    return null;
  }

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="text-base font-semibold">
          Cosa devi fare
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 space-y-3">
        <DashboardDeadlineTrackerContent
          alerts={tracker.alerts}
          clientsById={tracker.clientsById}
          createPath={tracker.createPath}
          dueSoonCount={tracker.dueSoonCount}
          dueSoonPayments={tracker.dueSoonPayments}
          dueSoonTotal={tracker.dueSoonTotal}
          isUpdating={tracker.isUpdating}
          onMarkPaymentAsReceived={tracker.markPaymentAsReceived}
          onMarkTaskAsDone={tracker.markTaskAsDone}
          otherCount={tracker.otherCount}
          overdueCount={tracker.overdueCount}
          overduePayments={tracker.overduePayments}
          overdueTotal={tracker.overdueTotal}
          todayIso={tracker.todayIso}
          totalItems={tracker.totalItems}
          upcomingTasks={tracker.upcomingTasks}
        />
      </CardContent>
    </Card>
  );
};
