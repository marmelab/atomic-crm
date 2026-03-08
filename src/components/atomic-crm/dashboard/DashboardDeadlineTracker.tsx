import { CheckCircle2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useCreatePath, useGetList, useUpdate, type Identifier } from "ra-core";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import type { Client, ClientTask, Payment } from "../types";
import { paymentStatusLabels } from "../payments/paymentTypes";
import { SendPaymentReminderDialog } from "../payments/SendPaymentReminderDialog";
import { formatDateRange } from "../misc/formatDateRange";
import { formatCompactCurrency, type DashboardAlerts } from "./dashboardModel";

const LARGE_PAGE = { page: 1, perPage: 1000 };

const toStartOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const diffDays = (from: Date, to: Date) => {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor(
    (toStartOfDay(to).valueOf() - toStartOfDay(from).valueOf()) / msPerDay,
  );
};

const toLocalISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatShortDate = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "--";
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
};

const formatAmount = (value: number) =>
  value.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

const getClientName = (
  clientsById: Map<string, Client>,
  clientId?: Identifier | null,
) => {
  if (!clientId) return "Cliente";
  return clientsById.get(String(clientId))?.name ?? "Cliente";
};

export const getOverduePaymentsForDeadlineTracker = ({
  payments,
  today,
}: {
  payments: Payment[];
  today: Date;
}) =>
  payments
    .filter((payment) => {
      if (!payment.payment_date) {
        return payment.status === "scaduto";
      }
      const paymentDate = toStartOfDay(new Date(payment.payment_date));
      if (Number.isNaN(paymentDate.valueOf())) {
        return payment.status === "scaduto";
      }
      return payment.status === "scaduto" || paymentDate < today;
    })
    .sort(
      (left, right) =>
        new Date(left.payment_date ?? left.created_at).valueOf() -
        new Date(right.payment_date ?? right.created_at).valueOf(),
    );

export const getDueSoonPaymentsForDeadlineTracker = ({
  payments,
  today,
  limitDate,
}: {
  payments: Payment[];
  today: Date;
  limitDate: Date;
}) =>
  payments
    .filter((payment) => {
      if (payment.status !== "in_attesa" || !payment.payment_date) {
        return false;
      }
      const paymentDate = toStartOfDay(new Date(payment.payment_date));
      if (Number.isNaN(paymentDate.valueOf())) {
        return false;
      }
      return paymentDate >= today && paymentDate <= limitDate;
    })
    .sort(
      (left, right) =>
        new Date(left.payment_date ?? left.created_at).valueOf() -
        new Date(right.payment_date ?? right.created_at).valueOf(),
    );

export const getUpcomingTasksForDeadlineTracker = ({
  tasks,
  today,
  limitDate,
}: {
  tasks: ClientTask[];
  today: Date;
  limitDate: Date;
}) =>
  tasks
    .filter((task) => {
      if (task.done_date) return false;
      const dueDate = toStartOfDay(new Date(task.due_date));
      if (Number.isNaN(dueDate.valueOf())) return false;
      return dueDate >= today && dueDate <= limitDate;
    })
    .sort(
      (left, right) =>
        new Date(left.due_date).valueOf() - new Date(right.due_date).valueOf(),
    );

// ── Unified card: "Cosa devi fare" ──────────────────────────

export const DashboardDeadlineTracker = ({
  alerts,
}: {
  alerts: DashboardAlerts;
}) => {
  const today = toStartOfDay(new Date());
  const limitDate = new Date(today);
  limitDate.setDate(limitDate.getDate() + 7);

  const createPath = useCreatePath();

  const { data: clients = [] } = useGetList<Client>("clients", {
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

  const [update, { isPending: isUpdating }] = useUpdate();

  const clientsById = useMemo(
    () => new Map(clients.map((client) => [String(client.id), client])),
    [clients],
  );

  const overduePayments = getOverduePaymentsForDeadlineTracker({
    payments: pendingPayments,
    today,
  }).slice(0, 6);

  const dueSoonPayments = getDueSoonPaymentsForDeadlineTracker({
    payments: pendingPayments,
    today,
    limitDate,
  }).slice(0, 6);

  const upcomingTasks = getUpcomingTasksForDeadlineTracker({
    tasks: openTasks,
    today,
    limitDate,
  }).slice(0, 8);

  const markPaymentAsReceived = (payment: Payment) => {
    update("payments", {
      id: payment.id,
      data: {
        status: "ricevuto",
        payment_date: payment.payment_date ?? toLocalISODate(today),
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

  if (isPendingPayments || isPendingTasks) {
    return null;
  }

  // Counts for the 3-column header
  const overdueTotal = overduePayments.reduce(
    (sum, p) => sum + Number(p.amount ?? 0),
    0,
  );
  const dueSoonTotal = dueSoonPayments.reduce(
    (sum, p) => sum + Number(p.amount ?? 0),
    0,
  );
  const otherCount =
    upcomingTasks.length +
    alerts.upcomingServices.length +
    alerts.unansweredQuotes.length;

  const totalItems =
    overduePayments.length + dueSoonPayments.length + otherCount;

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="text-base font-semibold">
          Cosa devi fare
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 space-y-3">
        {totalItems === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-md py-4 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 text-sm font-bold">
            <CheckCircle2 className="h-4 w-4" />
            Tutto in ordine
          </div>
        ) : (
          <>
            {/* ── 3-column counters ── */}
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-0">
              <CounterColumn
                count={overduePayments.length}
                label="Scaduti"
                amount={overdueTotal}
                color="red"
              />
              <Separator orientation="vertical" />
              <CounterColumn
                count={dueSoonPayments.length}
                label="Prossimi 7g"
                amount={dueSoonTotal}
                color="amber"
              />
              <Separator orientation="vertical" />
              <CounterColumn count={otherCount} label="Da fare" color="blue" />
            </div>

            {/* ── Flat action list ── */}
            <div className="space-y-1.5">
              {overduePayments.map((payment) => {
                const days = payment.payment_date
                  ? Math.max(
                      1,
                      Math.abs(diffDays(new Date(payment.payment_date), today)),
                    )
                  : null;

                return (
                  <ActionRow
                    key={`op-${payment.id}`}
                    dot="red"
                    title={getClientName(clientsById, payment.client_id)}
                    subtitle={`${formatAmount(Number(payment.amount ?? 0))} · ${paymentStatusLabels[payment.status] ?? payment.status}${days ? ` · ${days}g fa` : ""}`}
                    link={createPath({
                      resource: "payments",
                      type: "show",
                      id: payment.id,
                    })}
                    actionLabel="Incassato"
                    onAction={() => markPaymentAsReceived(payment)}
                    disabled={isUpdating}
                    secondaryAction={
                      <SendPaymentReminderDialog paymentId={payment.id} />
                    }
                  />
                );
              })}

              {dueSoonPayments.map((payment) => {
                const daysUntil = payment.payment_date
                  ? diffDays(today, new Date(payment.payment_date))
                  : null;

                return (
                  <ActionRow
                    key={`ds-${payment.id}`}
                    dot="amber"
                    title={getClientName(clientsById, payment.client_id)}
                    subtitle={`${formatAmount(Number(payment.amount ?? 0))} · ${formatShortDate(payment.payment_date)}${daysUntil != null ? ` · tra ${daysUntil}g` : ""}`}
                    link={createPath({
                      resource: "payments",
                      type: "show",
                      id: payment.id,
                    })}
                    actionLabel="Incassato"
                    onAction={() => markPaymentAsReceived(payment)}
                    disabled={isUpdating}
                  />
                );
              })}

              {upcomingTasks.map((task) => {
                const daysUntil = diffDays(today, new Date(task.due_date));
                return (
                  <ActionRow
                    key={`tk-${task.id}`}
                    dot="blue"
                    title={task.text}
                    subtitle={`${getClientName(clientsById, task.client_id)} · ${formatShortDate(task.due_date)}${daysUntil >= 0 ? ` · tra ${daysUntil}g` : ""}`}
                    link="/client_tasks"
                    actionLabel="Fatto"
                    onAction={() => markTaskAsDone(task)}
                    disabled={isUpdating}
                  />
                );
              })}

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
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

// ── Sub-components ───────────────────────────────────────────

type DotColor = "red" | "amber" | "blue";

const dotClasses: Record<DotColor, string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  blue: "bg-blue-500",
};

const counterColors: Record<DotColor, { count: string; label: string }> = {
  red: {
    count: "text-red-700 dark:text-red-300",
    label: "text-red-600 dark:text-red-400",
  },
  amber: {
    count: "text-amber-700 dark:text-amber-300",
    label: "text-amber-600 dark:text-amber-400",
  },
  blue: {
    count: "text-blue-700 dark:text-blue-300",
    label: "text-blue-600 dark:text-blue-400",
  },
};

const CounterColumn = ({
  count,
  label,
  amount,
  color,
}: {
  count: number;
  label: string;
  amount?: number;
  color: DotColor;
}) => {
  const colors = counterColors[color];
  return (
    <div className="text-center space-y-0.5 px-2">
      <div className={`text-2xl font-bold tabular-nums ${colors.count}`}>
        {count}
      </div>
      <div
        className={`text-xs font-semibold uppercase tracking-wide ${colors.label}`}
      >
        {label}
      </div>
      {amount != null && amount > 0 && (
        <div className="text-[11px] text-muted-foreground tabular-nums">
          {formatAmount(amount)}
        </div>
      )}
    </div>
  );
};

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
    <span className={`shrink-0 h-2 w-2 rounded-full ${dotClasses[dot]}`} />
    <div className="min-w-0 flex-1">
      <Link
        to={link}
        className="text-sm font-medium hover:underline truncate block"
      >
        {title}
      </Link>
      <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
    </div>
    {(onAction || secondaryAction) && (
      <div className="flex items-center gap-1.5 shrink-0">
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

const prettifyServiceType = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
