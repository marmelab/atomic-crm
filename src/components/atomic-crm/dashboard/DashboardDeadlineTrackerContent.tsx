import type { Client, ClientTask, Payment } from "../types";
import { type CreatePathParams } from "ra-core";
import { DashboardDeadlineTrackerActionList } from "./DashboardDeadlineTrackerActionList";
import {
  DashboardDeadlineTrackerEmptyState,
  DashboardDeadlineTrackerSummary,
} from "./DashboardDeadlineTrackerSummary";
import { type DashboardAlerts } from "./dashboardModel";

type DashboardDeadlineTrackerContentProps = {
  alerts: DashboardAlerts;
  clientsById: Map<string, Client>;
  createPath: (params: CreatePathParams) => string;
  dueSoonCount: number;
  dueSoonPayments: Payment[];
  dueSoonTotal: number;
  isUpdating: boolean;
  onMarkPaymentAsReceived: (payment: Payment) => void;
  onMarkTaskAsDone: (task: ClientTask) => void;
  otherCount: number;
  overdueCount: number;
  overduePayments: Payment[];
  overdueTotal: number;
  todayIso: string;
  totalItems: number;
  upcomingTasks: ClientTask[];
};

export const DashboardDeadlineTrackerContent = ({
  alerts,
  clientsById,
  createPath,
  dueSoonCount,
  dueSoonPayments,
  dueSoonTotal,
  isUpdating,
  onMarkPaymentAsReceived,
  onMarkTaskAsDone,
  otherCount,
  overdueCount,
  overduePayments,
  overdueTotal,
  todayIso,
  totalItems,
  upcomingTasks,
}: DashboardDeadlineTrackerContentProps) => {
  if (totalItems === 0) {
    return <DashboardDeadlineTrackerEmptyState />;
  }

  return (
    <>
      <DashboardDeadlineTrackerSummary
        dueSoonCount={dueSoonCount}
        dueSoonTotal={dueSoonTotal}
        otherCount={otherCount}
        overdueCount={overdueCount}
        overdueTotal={overdueTotal}
      />
      <DashboardDeadlineTrackerActionList
        alerts={alerts}
        clientsById={clientsById}
        createPath={createPath}
        dueSoonPayments={dueSoonPayments}
        isUpdating={isUpdating}
        onMarkPaymentAsReceived={onMarkPaymentAsReceived}
        onMarkTaskAsDone={onMarkTaskAsDone}
        overduePayments={overduePayments}
        todayIso={todayIso}
        upcomingTasks={upcomingTasks}
      />
    </>
  );
};
