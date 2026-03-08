import type {
  AnnualQualityFlag,
  DashboardModel,
  OpenQuoteDrilldown,
  PendingPaymentDrilldown,
} from "@/components/atomic-crm/dashboard/dashboardModel";

export type AnnualOperationsContext = {
  meta: {
    selectedYear: number;
    isCurrentYear: boolean;
    asOfDate: string;
    asOfDateLabel: string;
    operationsPeriodLabel: string;
    monthlyReferenceLabel: string;
  };
  metrics: Array<{
    id: string;
    label: string;
    value: number | null;
    formattedValue: string;
    unit: "currency" | "count" | "percent";
    basis: "work_value" | "cash_expected" | "pipeline_potential" | "cost";
    subtitle: string;
    warningCode?: string;
  }>;
  expenses: {
    total: number;
    formattedTotal: string;
    count: number;
    byType: Array<{
      expenseType: string;
      label: string;
      amount: number;
      count: number;
    }>;
  };
  series: {
    revenueTrend: Array<{
      monthKey: string;
      label: string;
      revenue: number;
      kmCost: number;
    }>;
    categoryBreakdown: Array<{
      category: string;
      label: string;
      revenue: number;
    }>;
  };
  topClients: Array<{
    clientId: string;
    clientName: string;
    revenue: number;
  }>;
  drilldowns: {
    pendingPayments: Array<{
      paymentId: string;
      clientId: string;
      clientName: string;
      projectId?: string;
      projectName?: string;
      quoteId?: string;
      amount: number;
      status: string;
      paymentDate?: string;
    }>;
    openQuotes: Array<{
      quoteId: string;
      clientId: string;
      clientName: string;
      projectId?: string;
      projectName?: string;
      description: string;
      amount: number;
      status: string;
      statusLabel: string;
      sentDate?: string;
      hasProject: boolean;
      hasItemizedLines: boolean;
      quoteItemsCount: number;
    }>;
  };
  yearOverYear: {
    previousYear: number;
    annualRevenue: number;
    annualRevenueDeltaPct: number | null;
    cashReceivedNet: number;
    cashReceivedNetDeltaPct: number | null;
    annualExpensesTotal: number;
    annualExpensesTotalDeltaPct: number | null;
  } | null;
  qualityFlags: AnnualQualityFlag[];
  caveats: string[];
};

const serializePendingPayment = (
  payment: PendingPaymentDrilldown,
): AnnualOperationsContext["drilldowns"]["pendingPayments"][number] => ({
  paymentId: payment.paymentId,
  clientId: payment.clientId,
  clientName: payment.clientName,
  projectId: payment.projectId,
  projectName: payment.projectName,
  quoteId: payment.quoteId,
  amount: payment.amount,
  status: payment.status,
  paymentDate: payment.paymentDate,
});

const serializeOpenQuote = (
  quote: OpenQuoteDrilldown,
): AnnualOperationsContext["drilldowns"]["openQuotes"][number] => ({
  quoteId: quote.quoteId,
  clientId: quote.clientId,
  clientName: quote.clientName,
  projectId: quote.projectId,
  projectName: quote.projectName,
  description: quote.description,
  amount: quote.amount,
  status: quote.status,
  statusLabel: quote.statusLabel,
  sentDate: quote.sentDate,
  hasProject: quote.hasProject,
  hasItemizedLines: quote.hasItemizedLines,
  quoteItemsCount: quote.quoteItemsCount,
});

const pushCaveat = (caveats: string[], value: string) => {
  if (!caveats.includes(value)) {
    caveats.push(value);
  }
};

const formatCurrency = (value: number | null) =>
  value == null
    ? "N/D"
    : value.toLocaleString("it-IT", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      });

const formatCount = (value: number | null) => (value == null ? "N/D" : `${value}`);

const formatPercent = (value: number | null) =>
  value == null ? "N/D" : `${value > 0 ? "+" : ""}${Math.round(value)}%`;

export const buildAnnualOperationsContext = (
  model: DashboardModel,
): AnnualOperationsContext => {
  const caveats: string[] = [];

  pushCaveat(
    caveats,
    "Il valore del lavoro e dell'anno e del mese usa le tariffe nette di sconto, non gli incassi.",
  );
  pushCaveat(
    caveats,
    "I pagamenti da ricevere sono incassi attesi e non vanno confusi con il valore del lavoro gia svolto.",
  );
  pushCaveat(
    caveats,
    "I preventivi aperti sono pipeline potenziale, non ricavo gia acquisito.",
  );
  pushCaveat(
    caveats,
    "Questo contesto AI riguarda solo la parte operativa dell'anno: alert del giorno e simulazione fiscale restano fuori.",
  );
  pushCaveat(
    caveats,
    "Le spese escludono i crediti ricevuti e includono il rimborso km calcolato.",
  );
  if (model.isCurrentYear) {
    pushCaveat(
      caveats,
      `Spese e margini del ${model.selectedYear} sono parziali (fino al ${model.meta.asOfDateLabel}): sono stime provvisorie, non dati definitivi.`,
    );
  }

  if (model.isCurrentYear) {
    pushCaveat(
      caveats,
      `${model.selectedYear} e letto finora al ${model.meta.asOfDateLabel}.`,
    );
  } else {
    pushCaveat(
      caveats,
      `${model.selectedYear} e letto sull'intero anno, da gennaio a dicembre.`,
    );
  }

  if (model.kpis.yoy) {
    pushCaveat(
      caveats,
      `Il confronto anno su anno compara ${model.meta.selectedYear} con ${model.kpis.yoy.previousYear} allo stesso periodo (fino a ${model.meta.monthlyReferenceLabel}).`,
    );
  }

  if (model.qualityFlags.includes("future_services_excluded")) {
    pushCaveat(
      caveats,
      `I servizi futuri oltre il ${model.meta.asOfDateLabel} sono esclusi dai totali operativi.`,
    );
  }

  return {
    meta: {
      selectedYear: model.meta.selectedYear,
      isCurrentYear: model.meta.isCurrentYear,
      asOfDate: model.meta.asOfDate,
      asOfDateLabel: model.meta.asOfDateLabel,
      operationsPeriodLabel: model.meta.operationsPeriodLabel,
      monthlyReferenceLabel: model.meta.monthlyReferenceLabel,
    },
    metrics: [
      {
        id: "annual_work_value",
        label: "Valore del lavoro dell'anno",
        value: model.kpis.annualRevenue,
        formattedValue: formatCurrency(model.kpis.annualRevenue),
        unit: "currency",
        basis: "work_value",
        subtitle: `${model.meta.operationsPeriodLabel} · netto sconti, non incassi`,
      },
      {
        id: "monthly_work_value",
        label: "Valore del lavoro del mese",
        value: model.kpis.monthlyRevenue,
        formattedValue: formatCurrency(model.kpis.monthlyRevenue),
        unit: "currency",
        basis: "work_value",
        subtitle: `Rif. ${model.meta.monthlyReferenceLabel} · netto sconti`,
      },
      {
        id: "monthly_work_delta",
        label: "Variazione mese su mese",
        value: model.kpis.monthlyRevenueDeltaPct,
        formattedValue: formatPercent(model.kpis.monthlyRevenueDeltaPct),
        unit: "percent",
        basis: "work_value",
        subtitle: "Confronto solo sul mese precedente se davvero confrontabile",
        warningCode:
          model.kpis.monthlyRevenueDeltaPct == null ? "not_comparable" : undefined,
      },
      {
        id: "pending_payments_total",
        label: "Pagamenti da ricevere",
        value: model.kpis.pendingPaymentsTotal,
        formattedValue: formatCurrency(model.kpis.pendingPaymentsTotal),
        unit: "currency",
        basis: "cash_expected",
        subtitle: `${model.kpis.pendingPaymentsCount} pagamenti attesi`,
      },
      {
        id: "pending_payments_count",
        label: "Numero pagamenti da ricevere",
        value: model.kpis.pendingPaymentsCount,
        formattedValue: formatCount(model.kpis.pendingPaymentsCount),
        unit: "count",
        basis: "cash_expected",
        subtitle: "Incassi attesi, non lavoro svolto",
      },
      {
        id: "open_quotes_amount",
        label: "Valore preventivi aperti",
        value: model.kpis.openQuotesAmount,
        formattedValue: formatCurrency(model.kpis.openQuotesAmount),
        unit: "currency",
        basis: "pipeline_potential",
        subtitle: `${model.kpis.openQuotesCount} preventivi aperti`,
      },
      {
        id: "open_quotes_count",
        label: "Numero preventivi aperti",
        value: model.kpis.openQuotesCount,
        formattedValue: formatCount(model.kpis.openQuotesCount),
        unit: "count",
        basis: "pipeline_potential",
        subtitle: "Opportunita ancora da chiudere",
      },
      {
        id: "annual_expenses_total",
        label: "Spese operative dell'anno",
        value: model.kpis.annualExpensesTotal,
        formattedValue: formatCurrency(model.kpis.annualExpensesTotal),
        unit: "currency",
        basis: "cost",
        subtitle: `${model.kpis.annualExpensesCount} spese registrate, esclusi crediti ricevuti`,
      },
      {
        id: "cash_received_net",
        label: "Incassato netto (cassa)",
        value: model.kpis.cashReceivedNet,
        formattedValue: formatCurrency(model.kpis.cashReceivedNet),
        unit: "currency",
        basis: "cash_expected",
        subtitle: "Pagamenti ricevuti meno rimborsi emessi",
      },
    ],
    expenses: {
      total: model.kpis.annualExpensesTotal,
      formattedTotal: formatCurrency(model.kpis.annualExpensesTotal),
      count: model.kpis.annualExpensesCount,
      byType: model.kpis.expensesByType.map((point) => ({
        expenseType: point.expenseType,
        label: point.label,
        amount: point.amount,
        count: point.count,
      })),
    },
    series: {
      revenueTrend: model.revenueTrend.map((point) => ({
        monthKey: point.monthKey,
        label: point.label,
        revenue: point.revenue,
        kmCost: point.kmCost,
      })),
      categoryBreakdown: model.categoryBreakdown.map((point) => ({
        category: point.category,
        label: point.label,
        revenue: point.revenue,
      })),
    },
    topClients: model.topClients.map((client) => ({
      clientId: client.clientId,
      clientName: client.clientName,
      revenue: client.revenue,
    })),
    drilldowns: {
      pendingPayments: model.drilldowns.pendingPayments.map(
        serializePendingPayment,
      ),
      openQuotes: model.drilldowns.openQuotes.map(serializeOpenQuote),
    },
    yearOverYear: model.kpis.yoy
      ? {
          previousYear: model.kpis.yoy.previousYear,
          annualRevenue: model.kpis.yoy.annualRevenue,
          annualRevenueDeltaPct: model.kpis.yoy.annualRevenueDeltaPct,
          cashReceivedNet: model.kpis.yoy.cashReceivedNet,
          cashReceivedNetDeltaPct: model.kpis.yoy.cashReceivedNetDeltaPct,
          annualExpensesTotal: model.kpis.yoy.annualExpensesTotal,
          annualExpensesTotalDeltaPct:
            model.kpis.yoy.annualExpensesTotalDeltaPct,
        }
      : null,
    qualityFlags: model.qualityFlags,
    caveats,
  };
};
