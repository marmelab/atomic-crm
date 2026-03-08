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
  expensesByType: ExpenseByTypePoint[];
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
  serviceType: string;
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
