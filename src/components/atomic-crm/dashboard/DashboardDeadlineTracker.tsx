import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useCreatePath, useGetList, useUpdate, type Identifier } from "ra-core";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { Client, ClientTask, Payment } from "../types";
import { paymentStatusLabels } from "../payments/paymentTypes";

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

  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
  });
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
      if (task.done_date) {
        return false;
      }

      const dueDate = toStartOfDay(new Date(task.due_date));
      if (Number.isNaN(dueDate.valueOf())) {
        return false;
      }
      return dueDate >= today && dueDate <= limitDate;
    })
    .sort(
      (left, right) =>
        new Date(left.due_date).valueOf() - new Date(right.due_date).valueOf(),
    );

export const DashboardDeadlineTracker = () => {
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
      data: {
        done_date: new Date().toISOString(),
      },
      previousData: task,
    });
  };

  if (isPendingPayments || isPendingTasks) {
    return null;
  }

  return (
    <Card className="gap-0">
      <CardHeader className="px-4 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          Scadenzario operativo
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Pagamenti e promemoria da tenere sotto controllo nei prossimi giorni.
        </p>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-5">
        <Section
          title="Pagamenti scaduti"
          count={overduePayments.length}
          variant="destructive"
          icon={<AlertTriangle className="h-4 w-4" />}
        >
          {overduePayments.length === 0 ? (
            <EmptyText text="Nessun pagamento scaduto." />
          ) : (
            overduePayments.map((payment) => {
              const days = payment.payment_date
                ? Math.max(
                    1,
                    Math.abs(diffDays(new Date(payment.payment_date), today)),
                  )
                : null;

              return (
                <ActionRow
                  key={String(payment.id)}
                  title={getClientName(clientsById, payment.client_id)}
                  subtitle={`${formatAmount(Number(payment.amount ?? 0))} · ${paymentStatusLabels[payment.status] ?? payment.status}${days ? ` · ${days}g` : ""}`}
                  link={createPath({
                    resource: "payments",
                    type: "show",
                    id: payment.id,
                  })}
                  actionLabel="Segna come incassato"
                  onAction={() => markPaymentAsReceived(payment)}
                  disabled={isUpdating}
                />
              );
            })
          )}
        </Section>

        <Section
          title="Pagamenti in scadenza"
          count={dueSoonPayments.length}
          variant="warning"
          icon={<CalendarClock className="h-4 w-4" />}
        >
          {dueSoonPayments.length === 0 ? (
            <EmptyText text="Nessun pagamento in scadenza entro 7 giorni." />
          ) : (
            dueSoonPayments.map((payment) => {
              const daysUntil = payment.payment_date
                ? diffDays(today, new Date(payment.payment_date))
                : null;

              return (
                <ActionRow
                  key={String(payment.id)}
                  title={getClientName(clientsById, payment.client_id)}
                  subtitle={`${formatAmount(Number(payment.amount ?? 0))} · scade ${formatShortDate(payment.payment_date)}${daysUntil != null ? ` · ${daysUntil}g` : ""}`}
                  link={createPath({
                    resource: "payments",
                    type: "show",
                    id: payment.id,
                  })}
                  actionLabel="Segna come incassato"
                  onAction={() => markPaymentAsReceived(payment)}
                  disabled={isUpdating}
                />
              );
            })
          )}
        </Section>

        <Section
          title="Promemoria in scadenza"
          count={upcomingTasks.length}
          variant="outline"
          icon={<CheckCircle2 className="h-4 w-4" />}
        >
          {upcomingTasks.length === 0 ? (
            <EmptyText text="Nessun promemoria in scadenza entro 7 giorni." />
          ) : (
            upcomingTasks.map((task) => {
              const daysUntil = diffDays(today, new Date(task.due_date));

              return (
                <ActionRow
                  key={String(task.id)}
                  title={task.text}
                  subtitle={`${getClientName(clientsById, task.client_id)} · scade ${formatShortDate(task.due_date)}${daysUntil >= 0 ? ` · ${daysUntil}g` : ""}`}
                  link="/client_tasks"
                  actionLabel="Segna come fatto"
                  onAction={() => markTaskAsDone(task)}
                  disabled={isUpdating}
                />
              );
            })
          )}
        </Section>
      </CardContent>
    </Card>
  );
};

const Section = ({
  title,
  count,
  variant,
  icon,
  children,
}: {
  title: string;
  count: number;
  variant: "destructive" | "warning" | "outline";
  icon: ReactNode;
  children: ReactNode;
}) => (
  <section className="space-y-2">
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <p className="text-sm font-medium flex-1">{title}</p>
      {count > 0 ? <Badge variant={variant}>{count}</Badge> : null}
    </div>
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      {children}
    </div>
  </section>
);

const ActionRow = ({
  title,
  subtitle,
  link,
  actionLabel,
  onAction,
  disabled,
}: {
  title: string;
  subtitle: string;
  link: string;
  actionLabel: string;
  onAction: () => void;
  disabled: boolean;
}) => (
  <div className="flex items-start gap-3 justify-between">
    <div className="min-w-0">
      <Link to={link} className="text-sm font-medium hover:underline">
        {title}
      </Link>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
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
  </div>
);

const EmptyText = ({ text }: { text: string }) => (
  <p className="text-xs text-muted-foreground">{text}</p>
);
