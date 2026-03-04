import type {
  Client,
  Expense,
  Payment,
  Project,
  Quote,
  Service,
} from "../../types";
import { buildDashboardModel } from "../../dashboard/dashboardModel";
import {
  buildDashboardHistoryModel,
  type AnalyticsClientLifetimeCompetenceRevenueRow,
  type AnalyticsHistoryMetaRow,
  type AnalyticsYearlyCompetenceRevenueByCategoryRow,
  type AnalyticsYearlyCompetenceRevenueRow,
} from "../../dashboard/dashboardHistoryModel";
import { buildAnalyticsContext } from "@/lib/analytics/buildAnalyticsContext";
import { buildAnnualOperationsContext } from "@/lib/analytics/buildAnnualOperationsContext";
import {
  buildHistoricalCashInflowContext,
  type AnalyticsYearlyCashInflowRow,
} from "@/lib/analytics/buildHistoricalCashInflowContext";
import { LARGE_PAGE, type BaseProvider } from "./dataProviderTypes";

/** Builds historical competence-revenue context from analytics views. */
export const getHistoricalAnalyticsContextFromViews = async (
  provider: BaseProvider,
) => {
  const [
    metaResponse,
    yearlyRevenueResponse,
    categoryMixResponse,
    topClientsResponse,
  ] = await Promise.all([
    provider.getOne<AnalyticsHistoryMetaRow>("analytics_history_meta", {
      id: 1,
    }),
    provider.getList<AnalyticsYearlyCompetenceRevenueRow>(
      "analytics_yearly_competence_revenue",
      {
        pagination: { page: 1, perPage: 200 },
        sort: { field: "year", order: "ASC" },
        filter: {},
      },
    ),
    provider.getList<AnalyticsYearlyCompetenceRevenueByCategoryRow>(
      "analytics_yearly_competence_revenue_by_category",
      {
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "year", order: "ASC" },
        filter: {},
      },
    ),
    provider.getList<AnalyticsClientLifetimeCompetenceRevenueRow>(
      "analytics_client_lifetime_competence_revenue",
      {
        pagination: { page: 1, perPage: 10 },
        sort: { field: "lifetime_revenue", order: "DESC" },
        filter: {},
      },
    ),
  ]);

  const historyModel = buildDashboardHistoryModel({
    meta: metaResponse.data,
    yearlyRevenueRows: yearlyRevenueResponse.data,
    categoryRows: categoryMixResponse.data,
    clientRows: topClientsResponse.data,
  });

  return buildAnalyticsContext(historyModel);
};

/** Builds historical cash-inflow context from analytics views. */
export const getHistoricalCashInflowContextFromViews = async (
  provider: BaseProvider,
) => {
  const [metaResponse, cashInflowResponse] = await Promise.all([
    provider.getOne<AnalyticsHistoryMetaRow>("analytics_history_meta", {
      id: 1,
    }),
    provider.getList<AnalyticsYearlyCashInflowRow>(
      "analytics_yearly_cash_inflow",
      {
        pagination: { page: 1, perPage: 200 },
        sort: { field: "year", order: "ASC" },
        filter: {},
      },
    ),
  ]);

  return buildHistoricalCashInflowContext({
    meta: metaResponse.data,
    yearlyCashInflowRows: cashInflowResponse.data,
  });
};

/** Builds annual operations context from live resource tables. */
export const getAnnualOperationsContextFromResources = async (
  provider: BaseProvider,
  year: number,
) => {
  const [
    paymentsResponse,
    quotesResponse,
    servicesResponse,
    projectsResponse,
    clientsResponse,
    expensesResponse,
  ] = await Promise.all([
    provider.getList<Payment>("payments", {
      pagination: LARGE_PAGE,
      sort: { field: "payment_date", order: "ASC" },
      filter: {},
    }),
    provider.getList<Quote>("quotes", {
      pagination: LARGE_PAGE,
      sort: { field: "updated_at", order: "DESC" },
      filter: {},
    }),
    provider.getList<Service>("services", {
      pagination: LARGE_PAGE,
      sort: { field: "service_date", order: "DESC" },
      filter: {},
    }),
    provider.getList<Project>("projects", {
      pagination: LARGE_PAGE,
      sort: { field: "created_at", order: "DESC" },
      filter: {},
    }),
    provider.getList<Client>("clients", {
      pagination: LARGE_PAGE,
      sort: { field: "created_at", order: "DESC" },
      filter: {},
    }),
    provider.getList<Expense>("expenses", {
      pagination: LARGE_PAGE,
      sort: { field: "expense_date", order: "DESC" },
      filter: {},
    }),
  ]);

  const model = buildDashboardModel({
    payments: paymentsResponse.data,
    quotes: quotesResponse.data,
    services: servicesResponse.data,
    projects: projectsResponse.data,
    clients: clientsResponse.data,
    expenses: expensesResponse.data,
    year,
  });

  return buildAnnualOperationsContext(model);
};
