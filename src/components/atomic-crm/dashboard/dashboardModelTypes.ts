import type { Service } from "../types";
import type { FiscalModel } from "./fiscalModel";

export type MonthlyRevenueRow = {
  id?: string | number;
  month: string;
  category: string;
  revenue: number | string | null;
  total_km: number | string | null;
  km_cost: number | string | null;
};

export type DashboardModel = {
  meta: DashboardMeta;
  kpis: DashboardKpis;
  revenueTrend: RevenueTrendPoint[];
  categoryBreakdown: CategoryBreakdownPoint[];
  quotePipeline: QuotePipelinePoint[];
  topClients: TopClientPoint[];
  drilldowns: DashboardDrilldowns;
  alerts: DashboardAlerts;
  cashFlowForecast: CashFlowForecast | null;
  fiscal: FiscalModel | null;
  qualityFlags: AnnualQualityFlag[];
  selectedYear: number;
  isCurrentYear: boolean;
};

export type DashboardMeta = {
  selectedYear: number;
  isCurrentYear: boolean;
  asOfDate: string;
  asOfDateLabel: string;
  operationsPeriodLabel: string;
  monthlyReferenceLabel: string;
};

export type AnnualQualityFlag =
  | "partial_current_year"
  | "future_services_excluded"
  | "alerts_current_snapshot"
  | "fiscal_simulation";

export type ExpenseByTypePoint = {
  expenseType: string;
  label: string;
  amount: number;
  count: number;
};

export type DashboardKpis = {
  monthlyRevenue: number;
  previousMonthRevenue: number;
  monthlyRevenueDeltaPct: number | null;
  annualRevenue: number;
  pendingPaymentsTotal: number;
  pendingPaymentsCount: number;
  openQuotesCount: number;
  openQuotesAmount: number;
  monthlyKm: number;
  monthlyKmCost: number;
  annualExpensesTotal: number;
  annualExpensesCount: number;
  /** Expenses NOT linked to any project — true own costs. */
  ownExpenses: number;
  /** Expenses linked to a project — typically reimbursed by the client. */
  clientExpenses: number;
  expensesByType: ExpenseByTypePoint[];
  /** Total cash received (ricevuto, no rimborso) minus refunds — cash basis. */
  cashReceivedNet: number;
  /** YoY: same metric values for the same period of the previous year. */
  yoy: YearOverYearComparison | null;
};

export type YearOverYearComparison = {
  previousYear: number;
  /** Revenue (competence) up to the same month of the previous year. */
  annualRevenue: number;
  annualRevenueDeltaPct: number | null;
  /** Cash received net up to the same month of the previous year. */
  cashReceivedNet: number;
  cashReceivedNetDeltaPct: number | null;
  /** Expenses up to the same month of the previous year. */
  annualExpensesTotal: number;
  annualExpensesTotalDeltaPct: number | null;
};

export type RevenueTrendPoint = {
  monthKey: string;
  label: string;
  revenue: number;
  kmCost: number;
};

export type CategoryBreakdownPoint = {
  category: string;
  label: string;
  revenue: number;
};

export type QuotePipelinePoint = {
  status: string;
  label: string;
  count: number;
  amount: number;
};

export type TopClientPoint = {
  clientId: string;
  clientName: string;
  revenue: number;
};

export type DashboardDrilldowns = {
  pendingPayments: PendingPaymentDrilldown[];
  openQuotes: OpenQuoteDrilldown[];
};

export type CashFlowForecast = {
  /** Horizon in days (default 30). */
  horizonDays: number;
  /** Expected inflows: pending payments due within horizon. */
  inflows: CashFlowItem[];
  inflowsTotal: number;
  /** Expected outflows: fiscal deadlines within horizon. */
  outflows: CashFlowItem[];
  outflowsTotal: number;
  /** inflows - outflows. */
  netFlow: number;
};

export type CashFlowItem = {
  label: string;
  amount: number;
  date: string;
  type: "payment" | "fiscal_deadline";
};

export type DashboardAlerts = {
  paymentAlerts: PaymentAlert[];
  upcomingServices: UpcomingServiceAlert[];
  unansweredQuotes: UnansweredQuoteAlert[];
};

export type PendingPaymentDrilldown = {
  paymentId: string;
  clientId: string;
  clientName: string;
  projectId?: string;
  projectName?: string;
  quoteId?: string;
  amount: number;
  status: string;
  paymentDate?: string;
};

export type OpenQuoteDrilldown = {
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
};

export type PaymentAlert = {
  id: string;
  clientName: string;
  projectName?: string;
  notes?: string;
  amount: number;
  status: string;
  urgency: "overdue" | "due_soon" | "pending";
  paymentDate?: string;
  daysOffset?: number;
};

export type UpcomingServiceAlert = {
  id: string;
  serviceDate: string;
  serviceEnd?: string;
  allDay: boolean;
  projectName: string;
  clientName: string;
  serviceType: Service["service_type"];
  daysAhead: number;
};

export type UnansweredQuoteAlert = {
  id: string;
  clientName: string;
  description: string;
  status: string;
  sentDate: string;
  daysWaiting: number;
  amount: number;
};
