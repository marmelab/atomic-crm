import type { ConfigurationContextValue } from "@/components/atomic-crm/root/ConfigurationContext";
import { defaultConfiguration } from "@/components/atomic-crm/root/defaultConfiguration";
import type {
  Client,
  Payment,
  Project,
  Quote,
  Service,
} from "@/components/atomic-crm/types";

import {
  buildQuoteStatusEmailTemplate,
  type BuildQuoteStatusEmailInput,
} from "./quoteStatusEmailTemplates";

type QuoteStatusEmailContextInput = {
  quote: Pick<
    Quote,
    | "id"
    | "client_id"
    | "project_id"
    | "service_type"
    | "status"
    | "description"
    | "amount"
    | "event_start"
    | "event_end"
    | "all_day"
    | "sent_date"
    | "response_date"
    | "rejection_reason"
  >;
  client?: Pick<Client, "name" | "email"> | null;
  project?: Pick<Project, "name"> | null;
  payments?: Array<
    Pick<Payment, "amount" | "payment_date" | "payment_type" | "status">
  >;
  services?: Array<Pick<Service, "is_taxable">>;
  configuration?: Partial<Pick<ConfigurationContextValue, "title" | "quoteServiceTypes">>;
};

export type QuoteStatusEmailContext = Omit<
  BuildQuoteStatusEmailInput,
  "customMessage" | "publicQuoteUrl" | "supportEmail"
> & {
  quoteId: Quote["id"];
  clientId: Quote["client_id"];
  projectId?: Quote["project_id"] | null;
  latestReceivedPaymentAmount: number | null;
};

type QuoteStatusEmailTemplateOverrides = Pick<
  BuildQuoteStatusEmailInput,
  "customMessage" | "publicQuoteUrl" | "supportEmail" | "hasPdfAttachment"
>;

const getSignedPaymentAmount = (
  payment: Pick<Payment, "amount" | "payment_type">,
) => {
  if (payment.payment_type === "rimborso") {
    return -Number(payment.amount ?? 0);
  }

  return Number(payment.amount ?? 0);
};

const toSortableTimestamp = (value?: string) => {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 0 : date.valueOf();
};

const getLatestReceivedPaymentAmount = (
  payments: Array<
    Pick<Payment, "amount" | "payment_date" | "payment_type" | "status">
  >,
) => {
  const latestReceivedPayment = [...payments]
    .filter((payment) => payment.status === "ricevuto")
    .sort(
      (left, right) =>
        toSortableTimestamp(right.payment_date) -
        toSortableTimestamp(left.payment_date),
    )[0];

  return latestReceivedPayment
    ? getSignedPaymentAmount(latestReceivedPayment)
    : null;
};

export const buildQuoteStatusEmailContext = ({
  quote,
  client,
  project,
  payments = [],
  services = [],
  configuration,
}: QuoteStatusEmailContextInput): QuoteStatusEmailContext => {
  const mergedConfiguration = {
    title: configuration?.title ?? defaultConfiguration.title,
    quoteServiceTypes:
      configuration?.quoteServiceTypes ?? defaultConfiguration.quoteServiceTypes,
  };

  const receivedPayments = payments.filter(
    (payment) => payment.status === "ricevuto",
  );
  const amountPaid = receivedPayments.length
    ? receivedPayments.reduce(
        (sum, payment) => sum + getSignedPaymentAmount(payment),
        0,
      )
    : null;
  const latestReceivedPaymentAmount = getLatestReceivedPaymentAmount(payments);
  const resolvedServiceLabel =
    mergedConfiguration.quoteServiceTypes.find(
      (serviceType) => serviceType.value === quote.service_type,
    )?.label ??
    quote.service_type ??
    null;

  return {
    quoteId: quote.id,
    clientId: quote.client_id,
    projectId: quote.project_id ?? null,
    quote: {
      status: quote.status,
      description: quote.description,
      amount: quote.amount,
      event_start: quote.event_start,
      event_end: quote.event_end,
      all_day: quote.all_day,
      sent_date: quote.sent_date,
      response_date: quote.response_date,
      rejection_reason: quote.rejection_reason,
    },
    client: client ?? null,
    serviceLabel: resolvedServiceLabel,
    projectName: project?.name?.trim() || null,
    paymentAmount: latestReceivedPaymentAmount,
    amountPaid,
    amountDue: Number(quote.amount ?? 0) - Number(amountPaid ?? 0),
    businessName:
      mergedConfiguration.title?.trim() || defaultConfiguration.title,
    hasNonTaxableServices: services.some(
      (service) => service.is_taxable === false,
    ),
    latestReceivedPaymentAmount,
  };
};

export const buildQuoteStatusEmailTemplateFromContext = (
  context: QuoteStatusEmailContext,
  overrides: Partial<QuoteStatusEmailTemplateOverrides> = {},
) =>
  buildQuoteStatusEmailTemplate({
    ...context,
    ...overrides,
  });
