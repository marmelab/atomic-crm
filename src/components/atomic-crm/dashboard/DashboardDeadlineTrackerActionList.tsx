import { diffBusinessDays } from "@/lib/dateTimezone";
import { type ReactNode } from "react";
import { type CreatePathParams } from "ra-core";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import type { Client, ClientTask, Payment } from "../types";
import { paymentStatusLabels } from "../payments/paymentTypes";
import { SendPaymentReminderDialog } from "../payments/SendPaymentReminderDialog";
import { formatDateRange } from "../misc/formatDateRange";
import {
  formatFullCurrency,
  formatShortDate,
  getClientName,
  prettifyServiceType,
} from "./dashboardDeadlineTrackerFormatters";
import { formatCompactCurrency, type DashboardAlerts } from "./dashboardModel";

type DotColor = "red" | "amber" | "blue";

const dotClasses: Record<DotColor, string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  blue: "bg-blue-500",
};

const getDaysOverdue = (value: string | null | undefined, todayIso: string) => {
  if (!value) return null;
  return Math.max(1, Math.abs(diffBusinessDays(value, todayIso) ?? 0));
};

const getDaysUntil = (todayIso: string, value: string | null | undefined) => {
  if (!value) return null;
  return diffBusinessDays(todayIso, value);
};

export const DashboardDeadlineTrackerActionList = ({
  alerts,
  clientsById,
  createPath,
  dueSoonPayments,
  isUpdating,
  onMarkPaymentAsReceived,
  onMarkTaskAsDone,
  overduePayments,
  todayIso,
  upcomingTasks,
}: {
  alerts: DashboardAlerts;
  clientsById: Map<string, Client>;
  createPath: (params: CreatePathParams) => string;
  dueSoonPayments: Payment[];
  isUpdating: boolean;
  onMarkPaymentAsReceived: (payment: Payment) => void;
  onMarkTaskAsDone: (task: ClientTask) => void;
  overduePayments: Payment[];
  todayIso: string;
  upcomingTasks: ClientTask[];
}) => (
  <div className="space-y-1.5">
    <OverduePaymentRows
      clientsById={clientsById}
      createPath={createPath}
      isUpdating={isUpdating}
      onMarkPaymentAsReceived={onMarkPaymentAsReceived}
      overduePayments={overduePayments}
      todayIso={todayIso}
    />
    <DueSoonPaymentRows
      clientsById={clientsById}
      createPath={createPath}
      dueSoonPayments={dueSoonPayments}
      isUpdating={isUpdating}
      onMarkPaymentAsReceived={onMarkPaymentAsReceived}
      todayIso={todayIso}
    />
    <UpcomingTaskRows
      clientsById={clientsById}
      isUpdating={isUpdating}
      onMarkTaskAsDone={onMarkTaskAsDone}
      todayIso={todayIso}
      upcomingTasks={upcomingTasks}
    />
    <UpcomingServiceRows alerts={alerts} createPath={createPath} />
    <UnansweredQuoteRows alerts={alerts} createPath={createPath} />
  </div>
);

const OverduePaymentRows = ({
  clientsById,
  createPath,
  isUpdating,
  onMarkPaymentAsReceived,
  overduePayments,
  todayIso,
}: {
  clientsById: Map<string, Client>;
  createPath: (params: CreatePathParams) => string;
  isUpdating: boolean;
  onMarkPaymentAsReceived: (payment: Payment) => void;
  overduePayments: Payment[];
  todayIso: string;
}) => (
  <>
    {overduePayments.map((payment) => {
      const days = getDaysOverdue(payment.payment_date, todayIso);

      return (
        <ActionRow
          key={`op-${payment.id}`}
          dot="red"
          title={getClientName(clientsById, payment.client_id)}
          subtitle={`${formatFullCurrency(Number(payment.amount ?? 0))} · ${paymentStatusLabels[payment.status] ?? payment.status}${days ? ` · ${days}g fa` : ""}`}
          link={createPath({
            resource: "payments",
            type: "show",
            id: payment.id,
          })}
          actionLabel="Incassato"
          onAction={() => onMarkPaymentAsReceived(payment)}
          disabled={isUpdating}
          secondaryAction={<SendPaymentReminderDialog paymentId={payment.id} />}
        />
      );
    })}
  </>
);

const DueSoonPaymentRows = ({
  clientsById,
  createPath,
  dueSoonPayments,
  isUpdating,
  onMarkPaymentAsReceived,
  todayIso,
}: {
  clientsById: Map<string, Client>;
  createPath: (params: CreatePathParams) => string;
  dueSoonPayments: Payment[];
  isUpdating: boolean;
  onMarkPaymentAsReceived: (payment: Payment) => void;
  todayIso: string;
}) => (
  <>
    {dueSoonPayments.map((payment) => {
      const daysUntil = getDaysUntil(todayIso, payment.payment_date);

      return (
        <ActionRow
          key={`ds-${payment.id}`}
          dot="amber"
          title={getClientName(clientsById, payment.client_id)}
          subtitle={`${formatFullCurrency(Number(payment.amount ?? 0))} · ${formatShortDate(payment.payment_date)}${daysUntil != null ? ` · tra ${daysUntil}g` : ""}`}
          link={createPath({
            resource: "payments",
            type: "show",
            id: payment.id,
          })}
          actionLabel="Incassato"
          onAction={() => onMarkPaymentAsReceived(payment)}
          disabled={isUpdating}
        />
      );
    })}
  </>
);

const UpcomingTaskRows = ({
  clientsById,
  isUpdating,
  onMarkTaskAsDone,
  todayIso,
  upcomingTasks,
}: {
  clientsById: Map<string, Client>;
  isUpdating: boolean;
  onMarkTaskAsDone: (task: ClientTask) => void;
  todayIso: string;
  upcomingTasks: ClientTask[];
}) => (
  <>
    {upcomingTasks.map((task) => {
      const daysUntil = getDaysUntil(todayIso, task.due_date) ?? 0;

      return (
        <ActionRow
          key={`tk-${task.id}`}
          dot="blue"
          title={task.text}
          subtitle={`${getClientName(clientsById, task.client_id)} · ${formatShortDate(task.due_date)}${daysUntil >= 0 ? ` · tra ${daysUntil}g` : ""}`}
          link="/client_tasks"
          actionLabel="Fatto"
          onAction={() => onMarkTaskAsDone(task)}
          disabled={isUpdating}
        />
      );
    })}
  </>
);

const UpcomingServiceRows = ({
  alerts,
  createPath,
}: {
  alerts: DashboardAlerts;
  createPath: (params: CreatePathParams) => string;
}) => (
  <>
    {alerts.upcomingServices.map((service) => (
      <ActionRow
        key={`sv-${service.id}`}
        dot="blue"
        title={`${service.projectName} · ${prettifyServiceType(service.serviceType)}`}
        subtitle={`${service.clientName} · ${service.allDay ? formatShortDate(service.serviceDate) : formatDateRange(service.serviceDate, service.serviceEnd, false)}${service.daysAhead === 0 ? " · oggi" : ` · tra ${service.daysAhead}g`}`}
        link={createPath({
          resource: "services",
          type: "show",
          id: service.id,
        })}
      />
    ))}
  </>
);

const UnansweredQuoteRows = ({
  alerts,
  createPath,
}: {
  alerts: DashboardAlerts;
  createPath: (params: CreatePathParams) => string;
}) => (
  <>
    {alerts.unansweredQuotes.map((quote) => (
      <ActionRow
        key={`qt-${quote.id}`}
        dot="blue"
        title={`${quote.clientName} · ${quote.description}`}
        subtitle={`${formatCompactCurrency(quote.amount)} · inviato ${formatShortDate(quote.sentDate)} · ${quote.daysWaiting}g senza risposta`}
        link={createPath({
          resource: "quotes",
          type: "show",
          id: quote.id,
        })}
      />
    ))}
  </>
);

const ActionRow = ({
  dot,
  title,
  subtitle,
  link,
  actionLabel,
  onAction,
  disabled,
  secondaryAction,
}: {
  dot: DotColor;
  title: string;
  subtitle: string;
  link: string;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
  secondaryAction?: ReactNode;
}) => (
  <div className="flex items-center gap-2">
    <span className={`h-2 w-2 shrink-0 rounded-full ${dotClasses[dot]}`} />
    <div className="min-w-0 flex-1">
      <Link
        to={link}
        className="block truncate text-sm font-medium hover:underline"
      >
        {title}
      </Link>
      <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
    </div>
    {(onAction || secondaryAction) && (
      <div className="flex shrink-0 items-center gap-1.5">
        {secondaryAction}
        {onAction && actionLabel && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={onAction}
            disabled={disabled}
          >
            {actionLabel}
          </Button>
        )}
      </div>
    )}
  </div>
);
