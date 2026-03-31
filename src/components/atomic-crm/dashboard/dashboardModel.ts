import {
  addDaysToISODate,
  diffBusinessDays,
  formatBusinessDate,
  getBusinessMonthIndex,
  getBusinessMonthKey,
  getBusinessYear,
  todayISODate,
  toBusinessISODate,
} from "@/lib/dateTimezone";
import { format } from "date-fns";
import { it as itLocale } from "date-fns/locale";

import type {
  Client,
  Expense,
  FiscalConfig,
  Payment,
  Project,
  Quote,
  Service,
} from "../types";
import { sanitizeQuoteItems } from "../quotes/quoteItems";
import { quoteStatusLabels } from "../quotes/quotesTypes";
import { buildFiscalModel, getExpenseAmount } from "./fiscalModel";
import { getCategoryLabel } from "./dashboardFormatters";

// Re-export types and formatters so existing consumer imports keep working.
export type {
  MonthlyRevenueRow,
  DashboardModel,
  DashboardMeta,
  AnnualQualityFlag,
  DashboardKpis,
  YearOverYearComparison,
  ExpenseByTypePoint,
  RevenueTrendPoint,
  CategoryBreakdownPoint,
  QuotePipelinePoint,
  TopClientPoint,
  DashboardDrilldowns,
  CashFlowForecast,
  CashFlowItem,
  DashboardAlerts,
  PendingPaymentDrilldown,
  OpenQuoteDrilldown,
  PaymentAlert,
  UpcomingServiceAlert,
  UnansweredQuoteAlert,
} from "./dashboardModelTypes";

export {
  projectCategoryLabels,
  formatCurrency,
  formatCurrencyPrecise,
  formatCompactCurrency,
  formatShortDate,
  formatDayMonth,
  getCategoryLabel,
} from "./dashboardFormatters";

import type {
  AnnualQualityFlag,
  CashFlowForecast,
  CashFlowItem,
  DashboardModel,
  ExpenseByTypePoint,
  PaymentAlert,
  PendingPaymentDrilldown,
  OpenQuoteDrilldown,
  QuotePipelinePoint,
  UpcomingServiceAlert,
  UnansweredQuoteAlert,
  YearOverYearComparison,
} from "./dashboardModelTypes";
import { expenseTypeLabels } from "../expenses/expenseTypes";

const quotePipelineOrder = [
  "primo_contatto",
  "preventivo_inviato",
  "in_trattativa",
  "accettato",
  "acconto_ricevuto",
  "in_lavorazione",
  "completato",
  "saldato",
  "rifiutato",
  "perso",
] as const;

const quoteClosedForOpenKpi = new Set([
  "saldato",
  "rifiutato",
  "perso",
  "completato",
]);
const unansweredQuoteStatuses = new Set([
  "preventivo_inviato",
  "in_trattativa",
]);

const toNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const monthLabel = (date: Date) =>
  format(date, "MMM yy", { locale: itLocale }).replace(".", "");

const monthLabelShort = (date: Date) =>
  format(date, "MMM", { locale: itLocale }).replace(".", "");

const getServiceNetRevenue = (service: Service) =>
  toNumber(service.fee_shooting) +
  toNumber(service.fee_editing) +
  toNumber(service.fee_other) -
  toNumber(service.discount);

const isInBusinessYear = (
  value?: string,
  year = Number(todayISODate().slice(0, 4)),
) => {
  if (!value) return false;
  return getBusinessYear(value) === year;
};

export const buildDashboardModel = ({
  payments,
  quotes,
  services,
  projects,
  clients,
  expenses,
  fiscalConfig,
  year,
}: {
  payments: Payment[];
  quotes: Quote[];
  services: Service[];
  projects: Project[];
  clients: Client[];
  expenses: Expense[];
  fiscalConfig?: FiscalConfig;
  year?: number;
}): DashboardModel => {
  const todayIso = todayISODate();
  const nowYear = Number(todayIso.slice(0, 4));
  const nowMonthIndex = Number(todayIso.slice(5, 7)) - 1;
  // Validate year: must be a reasonable value, default to current year
  const selectedYear =
    year != null && Number.isFinite(year) && year >= 2000 && year <= nowYear
      ? year
      : nowYear;
  const isSelectedCurrentYear = selectedYear === nowYear;

  // For past years use Dec as reference month; for current year use today
  const referenceMonthIndex = isSelectedCurrentYear ? nowMonthIndex : 11;
  const referenceDate = new Date(
    Date.UTC(selectedYear, referenceMonthIndex, 15, 12, 0, 0),
  );
  const currentMonthKey = monthKey(referenceDate);
  const previousMonthDate = new Date(
    Date.UTC(selectedYear, referenceMonthIndex - 1, 15, 12, 0, 0),
  );
  const previousMonthKey = monthKey(previousMonthDate);

  const asOfDate = todayIso;
  const asOfDateLabel =
    formatBusinessDate(todayIso, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) ?? todayIso;
  const monthlyTotals = new Map<
    string,
    { revenue: number; totalKm: number; kmCost: number }
  >();
  const categoryTotals = new Map<string, number>();
  const qualityFlags: AnnualQualityFlag[] = [
    "alerts_current_snapshot",
    "fiscal_simulation",
  ];
  const pushQualityFlag = (flag: AnnualQualityFlag) => {
    if (!qualityFlags.includes(flag)) {
      qualityFlags.push(flag);
    }
  };
  const operationsProjectById = new Map(
    projects.map((project) => [String(project.id), project]),
  );
  let futureServicesExcludedCount = 0;

  for (const service of services) {
    if (!service.service_date) continue;
    const serviceDateIso = toBusinessISODate(service.service_date);
    if (!serviceDateIso) continue;
    if (getBusinessYear(service.service_date) !== selectedYear) continue;
    if (isSelectedCurrentYear && serviceDateIso > todayIso) {
      futureServicesExcludedCount += 1;
      continue;
    }

    const project = operationsProjectById.get(String(service.project_id));

    const revenue = getServiceNetRevenue(service);
    const key = getBusinessMonthKey(service.service_date);
    if (!key) continue;
    const bucket = monthlyTotals.get(key) ?? {
      revenue: 0,
      totalKm: 0,
      kmCost: 0,
    };
    bucket.revenue += revenue;
    bucket.totalKm += toNumber(service.km_distance);
    bucket.kmCost += toNumber(service.km_distance) * toNumber(service.km_rate);
    monthlyTotals.set(key, bucket);

    const cat = project ? project.category : "__flat";
    categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + revenue);
  }

  if (isSelectedCurrentYear) {
    pushQualityFlag("partial_current_year");
  }
  if (futureServicesExcludedCount > 0) {
    pushQualityFlag("future_services_excluded");
  }

  const lastVisibleMonthIndex = referenceMonthIndex;
  const visibleMonths = Array.from(
    { length: lastVisibleMonthIndex + 1 },
    (_, index) => new Date(selectedYear, index, 1),
  );

  const revenueTrend = visibleMonths.map((date) => {
    const key = monthKey(date);
    const values = monthlyTotals.get(key) ?? {
      revenue: 0,
      totalKm: 0,
      kmCost: 0,
    };
    return {
      monthKey: key,
      label: monthLabel(date),
      revenue: values.revenue,
      kmCost: values.kmCost,
    };
  });

  const currentMonthTotals = monthlyTotals.get(currentMonthKey) ?? {
    revenue: 0,
    totalKm: 0,
    kmCost: 0,
  };
  const previousMonthTotals = monthlyTotals.get(previousMonthKey) ?? {
    revenue: 0,
    totalKm: 0,
    kmCost: 0,
  };

  const monthlyRevenueDeltaPct =
    previousMonthDate.getFullYear() !== selectedYear
      ? null
      : previousMonthTotals.revenue > 0
        ? ((currentMonthTotals.revenue - previousMonthTotals.revenue) /
            previousMonthTotals.revenue) *
          100
        : currentMonthTotals.revenue > 0
          ? 100
          : null;

  const annualRevenue = Array.from(monthlyTotals.entries()).reduce(
    (sum, [key, value]) => {
      if (key.startsWith(`${selectedYear}-`)) {
        return sum + value.revenue;
      }
      return sum;
    },
    0,
  );

  // Filter payments and quotes by selected year
  const yearPayments = payments.filter((payment) => {
    const dateStr = payment.payment_date ?? payment.created_at;
    return isInBusinessYear(dateStr, selectedYear);
  });
  const yearQuotes = quotes.filter((quote) =>
    isInBusinessYear(quote.created_at, selectedYear),
  );

  // Exclude refunds from pending alerts (refunds are outgoing, not incoming)
  const pendingPayments = yearPayments.filter(
    (payment) =>
      payment.status !== "ricevuto" && payment.payment_type !== "rimborso",
  );
  const pendingPaymentsTotal = pendingPayments.reduce(
    (sum, payment) => sum + toNumber(payment.amount),
    0,
  );

  // Cash received net: total received (non-refund) minus refunds
  const cashReceivedNet = yearPayments.reduce((sum, payment) => {
    if (payment.status !== "ricevuto") return sum;
    const amount = toNumber(payment.amount);
    return payment.payment_type === "rimborso" ? sum - amount : sum + amount;
  }, 0);

  const openQuotes = yearQuotes.filter(
    (quote) => !quoteClosedForOpenKpi.has(quote.status),
  );
  const openQuotesAmount = openQuotes.reduce(
    (sum, quote) => sum + toNumber(quote.amount),
    0,
  );

  const quotePipelineSeed = new Map<string, QuotePipelinePoint>(
    quotePipelineOrder.map((status) => [
      status,
      {
        status,
        label: quoteStatusLabels[status] ?? status,
        count: 0,
        amount: 0,
      },
    ]),
  );

  for (const quote of yearQuotes) {
    const bucket = quotePipelineSeed.get(quote.status);
    if (!bucket) continue;
    bucket.count += 1;
    bucket.amount += toNumber(quote.amount);
  }

  const quotePipeline = quotePipelineOrder.map(
    (status) => quotePipelineSeed.get(status)!,
  );

  const projectById = operationsProjectById;
  const clientById = new Map(
    clients.map((client) => [String(client.id), client]),
  );

  const pendingPaymentDrilldowns = pendingPayments
    .map((payment) => {
      const project = payment.project_id
        ? projectById.get(String(payment.project_id))
        : undefined;
      return {
        paymentId: String(payment.id),
        clientId: payment.client_id != null ? String(payment.client_id) : "",
        clientName:
          clientById.get(
            payment.client_id != null ? String(payment.client_id) : "",
          )?.name ?? "Cliente",
        projectId:
          payment.project_id != null ? String(payment.project_id) : undefined,
        projectName: project?.name,
        quoteId:
          payment.quote_id != null ? String(payment.quote_id) : undefined,
        amount: toNumber(payment.amount),
        status: payment.status,
        paymentDate: payment.payment_date ?? undefined,
      } satisfies PendingPaymentDrilldown;
    })
    .sort((a, b) => {
      const statusOrder = { scaduto: 0, in_attesa: 1 } as const;
      const diff =
        (statusOrder[a.status as keyof typeof statusOrder] ?? 2) -
        (statusOrder[b.status as keyof typeof statusOrder] ?? 2);
      if (diff !== 0) return diff;
      if (a.paymentDate && b.paymentDate) {
        return a.paymentDate.localeCompare(b.paymentDate);
      }
      if (a.paymentDate) return -1;
      if (b.paymentDate) return 1;
      return b.amount - a.amount;
    });

  const openQuoteDrilldowns = openQuotes
    .map((quote) => {
      const project = quote.project_id
        ? projectById.get(String(quote.project_id))
        : undefined;
      const quoteItemsCount = sanitizeQuoteItems(quote.quote_items).length;
      return {
        quoteId: String(quote.id),
        clientId: String(quote.client_id),
        clientName: clientById.get(String(quote.client_id))?.name ?? "Cliente",
        projectId:
          quote.project_id != null ? String(quote.project_id) : undefined,
        projectName: project?.name,
        description: quote.description || "Preventivo",
        amount: toNumber(quote.amount),
        status: quote.status,
        statusLabel: quoteStatusLabels[quote.status] ?? quote.status,
        sentDate: quote.sent_date ?? undefined,
        hasProject: quote.project_id != null,
        hasItemizedLines: quoteItemsCount > 0,
        quoteItemsCount,
      } satisfies OpenQuoteDrilldown;
    })
    .sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      if (a.sentDate && b.sentDate) {
        return a.sentDate.localeCompare(b.sentDate);
      }
      if (a.sentDate) return -1;
      if (b.sentDate) return 1;
      return a.description.localeCompare(b.description);
    });

  const topClientRevenue = new Map<string, number>();
  for (const service of services) {
    if (!service.service_date) continue;
    const serviceDateIso = toBusinessISODate(service.service_date);
    if (!serviceDateIso) continue;
    if (getBusinessYear(service.service_date) !== selectedYear) continue;
    if (isSelectedCurrentYear && serviceDateIso > todayIso) continue;
    const project = projectById.get(String(service.project_id));
    const clientId = project
      ? String(project.client_id)
      : service.client_id
        ? String(service.client_id)
        : null;
    if (!clientId) continue;
    topClientRevenue.set(
      clientId,
      (topClientRevenue.get(clientId) ?? 0) + getServiceNetRevenue(service),
    );
  }

  const topClients = Array.from(topClientRevenue.entries())
    .map(([clientId, revenue]) => ({
      clientId,
      clientName: clientById.get(clientId)?.name ?? "Cliente",
      revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const categoryBreakdown = Array.from(categoryTotals.entries())
    .map(([category, revenue]) => ({
      category,
      label: getCategoryLabel(category),
      revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const paymentAlerts = pendingPayments
    .map((payment) => {
      const paymentDate = payment.payment_date;
      const paymentDateIso = paymentDate ? toBusinessISODate(paymentDate) : null;
      const clientName =
        clientById.get(
          payment.client_id != null ? String(payment.client_id) : "",
        )?.name ?? "Cliente";
      const project = payment.project_id
        ? projectById.get(String(payment.project_id))
        : undefined;
      const daysOffset = paymentDateIso
        ? (diffBusinessDays(todayIso, paymentDateIso) ?? undefined)
        : undefined;
      const isOverdue =
        payment.status === "scaduto" || (daysOffset != null && daysOffset < 0);
      const isDueSoon =
        daysOffset != null && daysOffset >= 0 && daysOffset <= 14;
      const urgency: PaymentAlert["urgency"] = isOverdue
        ? "overdue"
        : isDueSoon
          ? "due_soon"
          : "pending";
      return {
        id: String(payment.id),
        clientName,
        projectName: project?.name,
        notes: payment.notes,
        amount: toNumber(payment.amount),
        status: isOverdue ? "scaduto" : payment.status,
        urgency,
        paymentDate,
        daysOffset,
      } satisfies PaymentAlert;
    })
    .sort((a, b) => {
      const urgencyOrder = { overdue: 0, due_soon: 1, pending: 2 };
      const diff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (diff !== 0) return diff;
      return (a.daysOffset ?? 999) - (b.daysOffset ?? 999);
    })
    .slice(0, 10);

  const upcomingServices = services
    .map((service) => {
      const serviceDateIso = toBusinessISODate(service.service_date);
      if (!serviceDateIso) return null;
      const daysAhead = diffBusinessDays(todayIso, serviceDateIso) ?? 0;
      if (daysAhead < 0 || daysAhead > 14) return null;
      const project = projectById.get(String(service.project_id));
      const clientName = project
        ? (clientById.get(String(project.client_id))?.name ?? "Cliente")
        : "Cliente";
      return {
        id: String(service.id),
        serviceDate: service.service_date,
        serviceEnd: service.service_end ?? undefined,
        allDay: service.all_day,
        projectName: project?.name ?? "Progetto",
        clientName,
        serviceType: service.service_type,
        daysAhead,
      } satisfies UpcomingServiceAlert;
    })
    .filter((item): item is UpcomingServiceAlert => item !== null)
    .sort((a, b) => a.daysAhead - b.daysAhead)
    .slice(0, 6);

  const unansweredThresholdIso = addDaysToISODate(todayIso, -7);
  const unansweredQuotes = quotes
    .map((quote) => {
      if (!unansweredQuoteStatuses.has(quote.status)) return null;
      if (!quote.sent_date || quote.response_date) return null;
      const sentDateIso = toBusinessISODate(quote.sent_date);
      if (!sentDateIso) return null;
      if (sentDateIso > unansweredThresholdIso) return null;
      return {
        id: String(quote.id),
        clientName: clientById.get(String(quote.client_id))?.name ?? "Cliente",
        description: quote.description || "Preventivo",
        status: quote.status,
        sentDate: quote.sent_date,
        daysWaiting: Math.abs(
          diffBusinessDays(sentDateIso, todayIso) ?? 0,
        ),
        amount: toNumber(quote.amount),
      } satisfies UnansweredQuoteAlert;
    })
    .filter((item): item is UnansweredQuoteAlert => item !== null)
    .sort((a, b) => b.daysWaiting - a.daysWaiting)
    .slice(0, 6);

  // ── Expense aggregation (year-filtered, excluding credits) ─────────
  const expenseTypeBuckets = new Map<
    string,
    { amount: number; count: number }
  >();
  let annualExpensesTotal = 0;
  let annualExpensesCount = 0;
  let ownExpenses = 0;
  let clientExpenses = 0;

  for (const expense of expenses) {
    if (!expense.expense_date) continue;
    if (getBusinessYear(expense.expense_date) !== selectedYear) continue;
    if (expense.expense_type === "credito_ricevuto") continue;
    const amount = getExpenseAmount(expense);
    annualExpensesTotal += amount;
    annualExpensesCount += 1;
    if (expense.project_id || expense.source_service_id || expense.client_id) {
      clientExpenses += amount;
    } else {
      ownExpenses += amount;
    }
    const bucket = expenseTypeBuckets.get(expense.expense_type) ?? {
      amount: 0,
      count: 0,
    };
    bucket.amount += amount;
    bucket.count += 1;
    expenseTypeBuckets.set(expense.expense_type, bucket);
  }

  const expensesByType: ExpenseByTypePoint[] = Array.from(
    expenseTypeBuckets.entries(),
  )
    .map(([type, data]) => ({
      expenseType: type,
      label: expenseTypeLabels[type] ?? type,
      amount: data.amount,
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  // ── Year-over-year comparison (same period of previous year) ─────────
  const yoy = buildYearOverYear({
    selectedYear,
    referenceMonth: lastVisibleMonthIndex,
    payments,
    services,
    expenses,
    projects: operationsProjectById,
    isSelectedCurrentYear,
  });

  // ── Cash flow forecast (next 30 days, current year only) ───────────
  const cashFlowForecast = isSelectedCurrentYear
    ? buildCashFlowForecast({ pendingPayments, todayIso })
    : null;

  const fiscal = fiscalConfig
    ? buildFiscalModel({
        services,
        expenses,
        payments,
        quotes,
        projects,
        clients,
        fiscalConfig,
        year: selectedYear,
      })
    : null;

  // Post-processing: fill YoY delta percentages now that we have current KPIs
  if (yoy) {
    const deltaPct = (current: number, previous: number) =>
      previous > 0 ? ((current - previous) / previous) * 100 : null;
    yoy.annualRevenueDeltaPct = deltaPct(annualRevenue, yoy.annualRevenue);
    yoy.cashReceivedNetDeltaPct = deltaPct(
      cashReceivedNet,
      yoy.cashReceivedNet,
    );
    yoy.annualExpensesTotalDeltaPct = deltaPct(
      annualExpensesTotal,
      yoy.annualExpensesTotal,
    );
  }

  // Post-processing: inject fiscal deadline outflows into cash flow forecast
  if (cashFlowForecast && fiscal) {
    const horizonIso = addDaysToISODate(todayIso, cashFlowForecast.horizonDays);
    for (const deadline of fiscal.deadlines) {
      if (deadline.isPast || deadline.totalAmount === 0) continue;
      if (deadline.date > horizonIso) continue;
      cashFlowForecast.outflows.push({
        label: deadline.label,
        amount: deadline.totalAmount,
        date: deadline.date,
        type: "fiscal_deadline",
      });
      cashFlowForecast.outflowsTotal += deadline.totalAmount;
    }
    cashFlowForecast.netFlow =
      cashFlowForecast.inflowsTotal - cashFlowForecast.outflowsTotal;
  }

  const periodStartLabel = monthLabelShort(new Date(selectedYear, 0, 1));
  const periodEndLabel = monthLabelShort(
    new Date(selectedYear, lastVisibleMonthIndex, 1),
  );
  const operationsPeriodLabel =
    periodStartLabel === periodEndLabel
      ? `${periodEndLabel} ${selectedYear}`
      : `${periodStartLabel}-${periodEndLabel} ${selectedYear}`;
  const monthlyReferenceLabel = monthLabel(referenceDate);

  return {
    meta: {
      selectedYear,
      isCurrentYear: isSelectedCurrentYear,
      asOfDate,
      asOfDateLabel,
      operationsPeriodLabel,
      monthlyReferenceLabel,
    },
    kpis: {
      monthlyRevenue: currentMonthTotals.revenue,
      previousMonthRevenue: previousMonthTotals.revenue,
      monthlyRevenueDeltaPct,
      annualRevenue,
      pendingPaymentsTotal,
      pendingPaymentsCount: pendingPayments.length,
      openQuotesCount: openQuotes.length,
      openQuotesAmount,
      monthlyKm: currentMonthTotals.totalKm,
      monthlyKmCost: currentMonthTotals.kmCost,
      annualExpensesTotal,
      annualExpensesCount,
      ownExpenses,
      clientExpenses,
      expensesByType,
      cashReceivedNet,
      yoy,
    },
    revenueTrend,
    categoryBreakdown,
    quotePipeline,
    topClients,
    drilldowns: {
      pendingPayments: pendingPaymentDrilldowns,
      openQuotes: openQuoteDrilldowns,
    },
    alerts: {
      paymentAlerts,
      upcomingServices,
      unansweredQuotes,
    },
    cashFlowForecast,
    fiscal,
    qualityFlags,
    selectedYear,
    isCurrentYear: isSelectedCurrentYear,
  } satisfies DashboardModel;
};

// ── Year-over-year comparison builder ────────────────────────────────

const buildYearOverYear = ({
  selectedYear,
  referenceMonth,
  payments,
  services,
  expenses,
  projects: _projects,
  isSelectedCurrentYear,
}: {
  selectedYear: number;
  referenceMonth: number;
  payments: Payment[];
  services: Service[];
  expenses: Expense[];
  projects: Map<string, Project>;
  isSelectedCurrentYear: boolean;
}): YearOverYearComparison | null => {
  const prevYear = selectedYear - 1;
  // For current year we compare up to same month; for past years compare full year
  const maxMonth = isSelectedCurrentYear ? referenceMonth : 11;

  const isInPeriod = (dateStr: string | undefined, year: number) => {
    if (!dateStr) return false;
    const businessYear = getBusinessYear(dateStr);
    const businessMonthIndex = getBusinessMonthIndex(dateStr);
    if (businessYear == null || businessMonthIndex == null) return false;
    return businessYear === year && businessMonthIndex <= maxMonth;
  };

  // Previous year revenue (competence)
  let prevRevenue = 0;
  for (const service of services) {
    if (!isInPeriod(service.service_date, prevYear)) continue;
    prevRevenue += getServiceNetRevenue(service);
  }

  // Previous year cash received net
  let prevCashNet = 0;
  for (const payment of payments) {
    const dateStr = payment.payment_date ?? payment.created_at;
    if (!isInPeriod(dateStr, prevYear)) continue;
    if (payment.status !== "ricevuto") continue;
    const amount = toNumber(payment.amount);
    prevCashNet += payment.payment_type === "rimborso" ? -amount : amount;
  }

  // Previous year expenses
  let prevExpenses = 0;
  for (const expense of expenses) {
    if (!isInPeriod(expense.expense_date, prevYear)) continue;
    if (expense.expense_type === "credito_ricevuto") continue;
    prevExpenses += getExpenseAmount(expense);
  }

  // If no data at all for previous year, return null
  if (prevRevenue === 0 && prevCashNet === 0 && prevExpenses === 0) {
    return null;
  }

  return {
    previousYear: prevYear,
    annualRevenue: prevRevenue,
    annualRevenueDeltaPct: null, // filled by caller from kpis
    cashReceivedNet: prevCashNet,
    cashReceivedNetDeltaPct: null,
    annualExpensesTotal: prevExpenses,
    annualExpensesTotalDeltaPct: null,
  };
};

// ── Cash flow forecast builder (30-day horizon) ──────────────────────

const buildCashFlowForecast = ({
  pendingPayments,
  todayIso,
}: {
  pendingPayments: Payment[];
  todayIso: string;
}): CashFlowForecast => {
  const horizonDays = 30;
  const horizonIso = addDaysToISODate(todayIso, horizonDays);
  const inflows: CashFlowItem[] = [];
  const outflows: CashFlowItem[] = [];

  // Inflows: pending payments with a date within 30 days
  for (const payment of pendingPayments) {
    if (!payment.payment_date) continue;
    const paymentDateIso = toBusinessISODate(payment.payment_date);
    if (!paymentDateIso) continue;
    if (paymentDateIso < todayIso || paymentDateIso > horizonIso) continue;
    inflows.push({
      label: `Pagamento ${payment.notes || payment.payment_type || ""}`.trim(),
      amount: toNumber(payment.amount),
      date: payment.payment_date,
      type: "payment",
    });
  }

  // Outflows from fiscal deadlines are added by the caller after fiscal model is built
  const inflowsTotal = inflows.reduce((s, i) => s + i.amount, 0);
  const outflowsTotal = outflows.reduce((s, i) => s + i.amount, 0);

  return {
    horizonDays,
    inflows,
    inflowsTotal,
    outflows,
    outflowsTotal,
    netFlow: inflowsTotal - outflowsTotal,
  };
};
