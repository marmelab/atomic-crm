import {
  AlertTriangle,
  CalendarClock,
  Clock,
  ExternalLink,
  MessageCircleQuestion,
} from "lucide-react";
import { Link } from "react-router";
import { useCreatePath } from "ra-core";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { quoteStatusLabels } from "../quotes/quotesTypes";
import { formatDateRange } from "../misc/formatDateRange";
import {
  formatCompactCurrency,
  formatDayMonth,
  type DashboardAlerts,
  type PaymentAlert,
} from "./dashboardModel";

export const DashboardAlertsCard = ({
  alerts,
}: {
  alerts: DashboardAlerts;
}) => (
  <Card className="gap-0">
    <CardHeader className="px-4 pb-3">
      <CardTitle className="text-base">Scadenze e alert</CardTitle>
      <p className="text-xs text-muted-foreground">
        Fotografia di oggi: pagamenti, lavori vicini e preventivi senza risposta
      </p>
    </CardHeader>
    <CardContent className="px-4 pb-4 space-y-5">
      <AlertSection
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Pagamenti"
        count={alerts.paymentAlerts.length}
      >
        {alerts.paymentAlerts.length ? (
          alerts.paymentAlerts.map((payment) => (
            <PaymentAlertRow key={payment.id} payment={payment} />
          ))
        ) : (
          <EmptyText text="Nessun pagamento in sospeso." />
        )}
      </AlertSection>

      <AlertSection
        icon={<CalendarClock className="h-4 w-4" />}
        title="Prossimi lavori"
        count={alerts.upcomingServices.length}
      >
        {alerts.upcomingServices.length ? (
          alerts.upcomingServices.map((service) => (
            <ServiceAlertRow key={service.id} service={service} />
          ))
        ) : (
          <EmptyText text="Nessun lavoro nei prossimi 14 giorni." />
        )}
      </AlertSection>

      <AlertSection
        icon={<MessageCircleQuestion className="h-4 w-4" />}
        title="Preventivi senza risposta (>7g)"
        count={alerts.unansweredQuotes.length}
      >
        {alerts.unansweredQuotes.length ? (
          alerts.unansweredQuotes.map((quote) => (
            <QuoteAlertRow key={quote.id} quote={quote} />
          ))
        ) : (
          <EmptyText text="Nessun preventivo in attesa da oltre 7 giorni." />
        )}
      </AlertSection>
    </CardContent>
  </Card>
);

const AlertLink = ({ resource, id }: { resource: string; id: string }) => {
  const createPath = useCreatePath();
  return (
    <Link
      to={createPath({ resource, id, type: "show" })}
      className="shrink-0 p-1 -m-1 text-muted-foreground hover:text-foreground transition-colors"
      title="Apri dettaglio"
    >
      <ExternalLink className="h-3.5 w-3.5" />
    </Link>
  );
};

const PaymentAlertRow = ({ payment }: { payment: PaymentAlert }) => {
  const urgencyConfig = {
    overdue: {
      badge: "destructive" as const,
      label: "Scaduto",
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    due_soon: {
      badge: "warning" as const,
      label: "In scadenza",
      icon: <Clock className="h-3 w-3" />,
    },
    pending: { badge: "outline" as const, label: "In attesa", icon: null },
  };
  const config = urgencyConfig[payment.urgency];

  const dateInfo = payment.paymentDate
    ? payment.urgency === "overdue"
      ? `Scaduto il ${formatDayMonth(payment.paymentDate)}`
      : payment.daysOffset === 0
        ? "Scade oggi"
        : payment.daysOffset != null && payment.daysOffset > 0
          ? `Scade tra ${payment.daysOffset}g`
          : `Scadenza: ${formatDayMonth(payment.paymentDate)}`
    : "Senza scadenza";

  const detail = payment.projectName ?? payment.notes;

  return (
    <div className="flex items-start justify-between gap-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">
          {payment.clientName}
          {detail && (
            <span className="font-normal text-muted-foreground">
              {" "}
              · {detail}
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          {config.icon}
          {dateInfo}
        </p>
      </div>
      <Badge variant={config.badge}>
        {formatCompactCurrency(payment.amount)}
      </Badge>
      <AlertLink resource="payments" id={payment.id} />
    </div>
  );
};

const ServiceAlertRow = ({
  service,
}: {
  service: DashboardAlerts["upcomingServices"][number];
}) => (
  <div className="flex items-start justify-between gap-2 text-sm">
    <div className="min-w-0 flex-1">
      <p className="font-medium">
        {service.allDay
          ? formatDayMonth(service.serviceDate)
          : formatDateRange(
              service.serviceDate,
              service.serviceEnd,
              false,
            )}{" "}
        · {service.projectName}
      </p>
      <p className="text-xs text-muted-foreground">
        {service.clientName} · {prettifyServiceType(service.serviceType)} ·
        {service.daysAhead === 0 ? " oggi" : ` tra ${service.daysAhead}g`}
      </p>
    </div>
    <AlertLink resource="services" id={service.id} />
  </div>
);

const QuoteAlertRow = ({
  quote,
}: {
  quote: DashboardAlerts["unansweredQuotes"][number];
}) => (
  <div className="flex items-start justify-between gap-2 text-sm">
    <div className="min-w-0 flex-1">
      <p className="font-medium truncate">
        {quote.clientName} · {quote.description}
      </p>
      <p className="text-xs text-muted-foreground">
        {formatDayMonth(quote.sentDate)} · {quote.daysWaiting}g ·{" "}
        {quoteStatusLabels[quote.status] ?? quote.status} ·{" "}
        {formatCompactCurrency(quote.amount)}
      </p>
    </div>
    <AlertLink resource="quotes" id={quote.id} />
  </div>
);

const AlertSection = ({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) => (
  <section className="space-y-2">
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <p className="text-sm font-medium flex-1">{title}</p>
      {count > 0 && <Badge variant="outline">{count}</Badge>}
    </div>
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      {children}
    </div>
  </section>
);

const EmptyText = ({ text }: { text: string }) => (
  <p className="text-xs text-muted-foreground">{text}</p>
);

const prettifyServiceType = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
