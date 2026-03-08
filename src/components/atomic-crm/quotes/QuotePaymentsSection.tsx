import { useGetList } from "ra-core";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";

import { PaymentStatusBadge } from "../payments/PaymentListContent";
import { paymentTypeLabels } from "../payments/paymentTypes";
import type { Payment, Quote } from "../types";
import { buildQuotePaymentsSummary } from "./quotePaymentsSummary";

const formatCurrency = (value: number) =>
  value.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

const formatCountLabel = (value: number, singular: string, plural: string) =>
  `${value} ${value === 1 ? singular : plural}`;

const getRemainingLabel = (remainingAmount: number) => {
  if (remainingAmount < 0) return "Oltre il preventivo";
  if (remainingAmount === 0) return "Preventivo coperto";
  return "Ancora da collegare";
};

const formatPaymentDate = (value?: string) => {
  if (!value) return "Senza data";
  return new Date(value).toLocaleDateString("it-IT");
};

const getOpenRegisteredSubtitle = ({
  pendingCount,
  overdueCount,
}: {
  pendingCount: number;
  overdueCount: number;
}) => {
  if (pendingCount > 0 && overdueCount > 0) {
    return `${formatCountLabel(pendingCount, "in attesa", "in attesa")} · ${formatCountLabel(overdueCount, "scaduto", "scaduti")}`;
  }

  if (overdueCount > 0) {
    return formatCountLabel(overdueCount, "scaduto", "scaduti");
  }

  if (pendingCount > 0) {
    return formatCountLabel(
      pendingCount,
      "pagamento in attesa",
      "pagamenti in attesa",
    );
  }

  return "Nessun pagamento aperto";
};

const getDisplayPaymentAmount = (
  payment: Pick<Payment, "amount" | "payment_type">,
) =>
  formatCurrency(
    payment.payment_type === "rimborso" ? -payment.amount : payment.amount,
  );

export const QuotePaymentsSection = ({
  quote,
}: {
  quote: Pick<Quote, "id" | "amount">;
}) => {
  const { data, isPending, error } = useGetList<Payment>(
    "payments",
    {
      filter: { "quote_id@eq": quote.id },
      sort: { field: "payment_date", order: "DESC" },
      pagination: { page: 1, perPage: 100 },
    },
    {
      enabled: !!quote.id,
    },
  );

  return (
      <div className="sm:mx-4 rounded-lg border border-l-[3px] border-l-[#2C3E50] p-3 sm:p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#2C3E50]">
              Pagamenti collegati
            </span>
            {!isPending && !error ? (
              <Badge variant="outline">
                {(data?.length ?? 0) === 1
                  ? "1 pagamento"
                  : `${data?.length ?? 0} pagamenti`}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Qui vedi solo i pagamenti già collegati a questo preventivo. Serve a
            capire cosa è già coperto e cosa no.
          </p>
        </div>

        {error ? (
          <div className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
            Impossibile leggere i pagamenti collegati adesso.
          </div>
        ) : isPending ? (
          <div className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
            Caricamento pagamenti collegati...
          </div>
        ) : !data || data.length === 0 ? (
          <div className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
            Nessun pagamento collegato ancora a questo preventivo.
          </div>
        ) : (
          <QuotePaymentsLoadedState quote={quote} payments={data} />
        )}
      </div>
  );
};

const QuotePaymentsLoadedState = ({
  quote,
  payments,
}: {
  quote: Pick<Quote, "amount">;
  payments: Payment[];
}) => {
  const summary = buildQuotePaymentsSummary({
    quoteAmount: quote.amount,
    payments,
  });
  const openRegisteredTotal = summary.pendingTotal + summary.overdueTotal;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="Ricevuto"
          value={formatCurrency(summary.receivedTotal)}
          subtitle={formatCountLabel(
            summary.receivedCount,
            "pagamento ricevuto",
            "pagamenti ricevuti",
          )}
        />
        <MetricCard
          label="Da ricevere gia registrato"
          value={formatCurrency(openRegisteredTotal)}
          subtitle={getOpenRegisteredSubtitle(summary)}
        />
        <MetricCard
          label={getRemainingLabel(summary.remainingAmount)}
          value={formatCurrency(Math.abs(summary.remainingAmount))}
          subtitle={`Preventivo da ${formatCurrency(quote.amount)}`}
          tone={
            summary.remainingAmount < 0
              ? "warning"
              : summary.remainingAmount === 0
                ? "success"
                : "default"
          }
        />
      </div>

      <div className="rounded-md border">
        {payments.map((payment) => (
          <div
            key={payment.id}
            className="flex flex-col gap-3 border-b px-3 py-3 last:border-b-0 md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <Link
                to={`/payments/${payment.id}/show`}
                className="text-sm font-medium text-primary hover:underline"
              >
                {paymentTypeLabels[payment.payment_type] ??
                  payment.payment_type}
              </Link>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{formatPaymentDate(payment.payment_date)}</span>
                <PaymentStatusBadge status={payment.status} />
                {payment.invoice_ref ? (
                  <span>{payment.invoice_ref}</span>
                ) : null}
              </div>
            </div>

            <div className="text-sm font-medium">
              {getDisplayPaymentAmount(payment)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MetricCard = ({
  label,
  value,
  subtitle,
  tone = "default",
}: {
  label: string;
  value: string;
  subtitle: string;
  tone?: "default" | "success" | "warning";
}) => {
  const valueClassName =
    tone === "success"
      ? "text-green-700 dark:text-green-300"
      : tone === "warning"
        ? "text-amber-700 dark:text-amber-300"
        : "";

  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${valueClassName}`.trim()}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
};
