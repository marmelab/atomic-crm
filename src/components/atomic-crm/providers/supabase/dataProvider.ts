import { supabaseDataProvider } from "ra-supabase-core";
import { defaultPrimaryKeys } from "@raphiniert/ra-data-postgrest";
import {
  withLifecycleCallbacks,
  type DataProvider,
  type Identifier,
  type ResourceCallbacks,
} from "ra-core";
import type {
  ClientTask,
  Contact,
  Client,
  Expense,
  Payment,
  ProjectContact,
  Project,
  Quote,
  RAFile,
  Sale,
  SalesFormData,
  Service,
  SignUpData,
} from "../../types";
import { normalizeClientForSave } from "../../clients/clientBilling";
import {
  normalizeContactForSave,
  normalizeProjectContactForSave,
} from "../../contacts/contactRecord";
import type { ConfigurationContextValue } from "../../root/ConfigurationContext";
import { getIsInitialized } from "./authProvider";
import { getEdgeFunctionAuthorizationHeaders } from "./edgeFunctions";
import { supabase } from "./supabase";
import { buildDashboardModel } from "../../dashboard/dashboardModel";
import {
  buildDashboardHistoryModel,
  type AnalyticsClientLifetimeCompetenceRevenueRow,
  type AnalyticsHistoryMetaRow,
  type AnalyticsYearlyCompetenceRevenueByCategoryRow,
  type AnalyticsYearlyCompetenceRevenueRow,
} from "../../dashboard/dashboardHistoryModel";
import {
  buildAnalyticsContext,
  type AnalyticsContext,
} from "@/lib/analytics/buildAnalyticsContext";
import {
  buildAnnualOperationsContext,
  type AnnualOperationsContext,
} from "@/lib/analytics/buildAnnualOperationsContext";
import {
  buildHistoricalCashInflowContext,
  type AnalyticsYearlyCashInflowRow,
  type HistoricalCashInflowContext,
} from "@/lib/analytics/buildHistoricalCashInflowContext";
import {
  type AnnualOperationsAnalyticsAnswer,
  type AnnualOperationsAnalyticsSummary,
} from "@/lib/analytics/annualAnalysis";
import {
  defaultHistoricalAnalysisModel,
  type HistoricalAnalyticsAnswer,
  type HistoricalAnalyticsSummary,
} from "@/lib/analytics/historicalAnalysis";
import { defaultInvoiceExtractionModel } from "@/lib/ai/invoiceExtractionModel";
import type {
  GenerateInvoiceImportDraftRequest,
  InvoiceImportConfirmation,
  InvoiceImportDraft,
  InvoiceImportFileHandle,
  InvoiceImportWorkspace,
} from "@/lib/ai/invoiceImport";
import { buildInvoiceImportWorkspace } from "@/lib/ai/invoiceImportProvider";
import {
  buildUnifiedCrmReadContext,
  type UnifiedCrmReadContext,
} from "@/lib/ai/unifiedCrmReadContext";
import type {
  UnifiedCrmAnswer,
  UnifiedCrmConversationTurn,
} from "@/lib/ai/unifiedCrmAssistant";
import type {
  TravelRouteEstimate,
  TravelRouteEstimateRequest,
  TravelRouteLocationSuggestRequest,
  TravelRouteLocationSuggestion,
} from "@/lib/travelRouteEstimate";
import {
  buildCrmSemanticRegistry,
  type CrmSemanticRegistry,
} from "@/lib/semantics/crmSemanticRegistry";
import { buildCrmCapabilityRegistry } from "@/lib/semantics/crmCapabilityRegistry";
import {
  buildQuoteStatusEmailContext,
  type QuoteStatusEmailContext,
} from "@/lib/communications/quoteStatusEmailContext";
import type {
  QuoteStatusEmailSendRequest,
  QuoteStatusEmailSendResponse,
} from "@/lib/communications/quoteStatusEmailTemplates";

if (import.meta.env.VITE_SUPABASE_URL === undefined) {
  throw new Error("Please set the VITE_SUPABASE_URL environment variable");
}
if (import.meta.env.VITE_SB_PUBLISHABLE_KEY === undefined) {
  throw new Error(
    "Please set the VITE_SB_PUBLISHABLE_KEY environment variable",
  );
}

const baseDataProvider = supabaseDataProvider({
  instanceUrl: import.meta.env.VITE_SUPABASE_URL,
  apiKey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
  supabaseClient: supabase,
  sortOrder: "asc,desc.nullslast" as any,
  primaryKeys: new Map(defaultPrimaryKeys)
    .set("analytics_business_clock", ["id"])
    .set("analytics_history_meta", ["id"])
    .set("analytics_yearly_competence_revenue", ["year"])
    .set("analytics_yearly_cash_inflow", ["year"])
    .set("analytics_yearly_competence_revenue_by_category", [
      "year",
      "category",
    ])
    .set("analytics_client_lifetime_competence_revenue", ["client_id"])
    .set("monthly_revenue", ["month", "category"])
    .set("project_financials", ["project_id"]),
});

const LARGE_PAGE = { page: 1, perPage: 1000 };

const invokeAuthenticatedEdgeFunction = async <T>(
  functionName: string,
  options: Parameters<typeof supabase.functions.invoke<T>>[1] = {},
) => {
  const authHeaders = await getEdgeFunctionAuthorizationHeaders(supabase.auth);
  return supabase.functions.invoke<T>(functionName, {
    ...options,
    headers: {
      ...options.headers,
      ...authHeaders,
    },
  });
};

const getHistoricalAnalyticsContextFromViews = async () => {
  const [
    metaResponse,
    yearlyRevenueResponse,
    categoryMixResponse,
    topClientsResponse,
  ] = await Promise.all([
    baseDataProvider.getOne<AnalyticsHistoryMetaRow>("analytics_history_meta", {
      id: 1,
    }),
    baseDataProvider.getList<AnalyticsYearlyCompetenceRevenueRow>(
      "analytics_yearly_competence_revenue",
      {
        pagination: { page: 1, perPage: 200 },
        sort: { field: "year", order: "ASC" },
        filter: {},
      },
    ),
    baseDataProvider.getList<AnalyticsYearlyCompetenceRevenueByCategoryRow>(
      "analytics_yearly_competence_revenue_by_category",
      {
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "year", order: "ASC" },
        filter: {},
      },
    ),
    baseDataProvider.getList<AnalyticsClientLifetimeCompetenceRevenueRow>(
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

const getHistoricalCashInflowContextFromViews = async () => {
  const [metaResponse, cashInflowResponse] = await Promise.all([
    baseDataProvider.getOne<AnalyticsHistoryMetaRow>("analytics_history_meta", {
      id: 1,
    }),
    baseDataProvider.getList<AnalyticsYearlyCashInflowRow>(
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

const getConfiguredHistoricalAnalysisModel = async () => {
  const { data } = await baseDataProvider.getOne("configuration", { id: 1 });
  const config = (data?.config as ConfigurationContextValue | undefined) ?? {};
  return (
    config.aiConfig?.historicalAnalysisModel ?? defaultHistoricalAnalysisModel
  );
};

const getConfiguredInvoiceExtractionModel = async () => {
  const { data } = await baseDataProvider.getOne("configuration", { id: 1 });
  const config = (data?.config as ConfigurationContextValue | undefined) ?? {};
  return (
    config.aiConfig?.invoiceExtractionModel ?? defaultInvoiceExtractionModel
  );
};

const getInvoiceImportWorkspaceFromResources =
  async (): Promise<InvoiceImportWorkspace> => {
    const [clientsResponse, contactsResponse, projectsResponse] =
      await Promise.all([
        baseDataProvider.getList<Client>("clients", {
          pagination: LARGE_PAGE,
          sort: { field: "name", order: "ASC" },
          filter: {},
        }),
        baseDataProvider.getList<Contact>("contacts", {
          pagination: LARGE_PAGE,
          sort: { field: "updated_at", order: "DESC" },
          filter: {},
        }),
        baseDataProvider.getList<Project>("projects", {
          pagination: LARGE_PAGE,
          sort: { field: "name", order: "ASC" },
          filter: {},
        }),
      ]);

    return buildInvoiceImportWorkspace({
      clients: clientsResponse.data.map((client) => ({
        id: client.id,
        name: client.name,
        email: client.email ?? null,
        billing_name: client.billing_name ?? null,
        vat_number: client.vat_number ?? null,
        fiscal_code: client.fiscal_code ?? null,
        billing_city: client.billing_city ?? null,
      })),
      contacts: contactsResponse.data.map((contact) => ({
        id: contact.id,
        client_id: contact.client_id ?? null,
        first_name: contact.first_name ?? null,
        last_name: contact.last_name ?? null,
      })),
      projects: projectsResponse.data.map((project) => ({
        id: project.id,
        name: project.name,
        client_id: project.client_id,
      })),
    });
  };

const getUnifiedCrmReadContextFromResources =
  async (): Promise<UnifiedCrmReadContext> => {
    const [
      configuration,
      clientsResponse,
      contactsResponse,
      quotesResponse,
      projectsResponse,
      projectContactsResponse,
      servicesResponse,
      paymentsResponse,
      expensesResponse,
      tasksResponse,
    ] = await Promise.all([
      baseDataProvider.getOne("configuration", { id: 1 }),
      baseDataProvider.getList<Client>("clients", {
        pagination: LARGE_PAGE,
        sort: { field: "created_at", order: "DESC" },
        filter: {},
      }),
      baseDataProvider.getList<Contact>("contacts", {
        pagination: LARGE_PAGE,
        sort: { field: "updated_at", order: "DESC" },
        filter: {},
      }),
      baseDataProvider.getList<Quote>("quotes", {
        pagination: LARGE_PAGE,
        sort: { field: "created_at", order: "DESC" },
        filter: {},
      }),
      baseDataProvider.getList<Project>("projects", {
        pagination: LARGE_PAGE,
        sort: { field: "created_at", order: "DESC" },
        filter: {},
      }),
      baseDataProvider.getList<ProjectContact>("project_contacts", {
        pagination: LARGE_PAGE,
        sort: { field: "updated_at", order: "DESC" },
        filter: {},
      }),
      baseDataProvider.getList<Service>("services", {
        pagination: LARGE_PAGE,
        sort: { field: "service_date", order: "DESC" },
        filter: {},
      }),
      baseDataProvider.getList<Payment>("payments", {
        pagination: LARGE_PAGE,
        sort: { field: "payment_date", order: "DESC" },
        filter: {},
      }),
      baseDataProvider.getList<Expense>("expenses", {
        pagination: LARGE_PAGE,
        sort: { field: "expense_date", order: "DESC" },
        filter: {},
      }),
      baseDataProvider.getList<ClientTask>("client_tasks", {
        pagination: LARGE_PAGE,
        sort: { field: "due_date", order: "ASC" },
        filter: { "done_date@is": null },
      }),
    ]);

    const config =
      (configuration.data?.config as ConfigurationContextValue | undefined) ??
      {};

    return buildUnifiedCrmReadContext({
      clients: clientsResponse.data,
      contacts: contactsResponse.data,
      quotes: quotesResponse.data,
      projects: projectsResponse.data,
      projectContacts: projectContactsResponse.data,
      services: servicesResponse.data,
      payments: paymentsResponse.data,
      expenses: expensesResponse.data,
      tasks: tasksResponse.data,
      semanticRegistry: buildCrmSemanticRegistry(config),
      capabilityRegistry: buildCrmCapabilityRegistry(),
    });
  };

const getQuoteStatusEmailContextFromResources = async (quoteId: Identifier) => {
  const quoteResponse = await baseDataProvider.getOne<Quote>("quotes", {
    id: quoteId,
  });
  const quote = quoteResponse.data;
  const configurationPromise = baseDataProvider.getOne("configuration", {
    id: 1,
  });

  const [
    configurationResponse,
    clientResponse,
    projectResponse,
    paymentsResponse,
    servicesResponse,
  ] = await Promise.all([
    configurationPromise,
    quote.client_id
      ? baseDataProvider.getOne<Client>("clients", { id: quote.client_id })
      : Promise.resolve({ data: null }),
    quote.project_id
      ? baseDataProvider.getOne<Project>("projects", { id: quote.project_id })
      : Promise.resolve({ data: null }),
    baseDataProvider.getList<Payment>("payments", {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "payment_date", order: "DESC" },
      filter: { "quote_id@eq": quote.id },
    }),
    quote.project_id
      ? baseDataProvider.getList<Service>("services", {
          pagination: { page: 1, perPage: 1000 },
          sort: { field: "service_date", order: "ASC" },
          filter: { "project_id@eq": quote.project_id },
        })
      : Promise.resolve({ data: [] }),
  ]);

  const configuration =
    (configurationResponse.data?.config as
      | ConfigurationContextValue
      | undefined) ?? {};

  return buildQuoteStatusEmailContext({
    quote,
    client: clientResponse.data,
    project: projectResponse.data,
    payments: paymentsResponse.data,
    services: servicesResponse.data,
    configuration,
  });
};

const getAnnualOperationsContextFromResources = async (year: number) => {
  const [
    paymentsResponse,
    quotesResponse,
    servicesResponse,
    projectsResponse,
    clientsResponse,
    expensesResponse,
  ] = await Promise.all([
    baseDataProvider.getList<Payment>("payments", {
      pagination: LARGE_PAGE,
      sort: { field: "payment_date", order: "ASC" },
      filter: {},
    }),
    baseDataProvider.getList<Quote>("quotes", {
      pagination: LARGE_PAGE,
      sort: { field: "updated_at", order: "DESC" },
      filter: {},
    }),
    baseDataProvider.getList<Service>("services", {
      pagination: LARGE_PAGE,
      sort: { field: "service_date", order: "DESC" },
      filter: {},
    }),
    baseDataProvider.getList<Project>("projects", {
      pagination: LARGE_PAGE,
      sort: { field: "created_at", order: "DESC" },
      filter: {},
    }),
    baseDataProvider.getList<Client>("clients", {
      pagination: LARGE_PAGE,
      sort: { field: "created_at", order: "DESC" },
      filter: {},
    }),
    baseDataProvider.getList<Expense>("expenses", {
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

const dataProviderWithCustomMethods = {
  ...baseDataProvider,

  async signUp({ email, password, first_name, last_name }: SignUpData) {
    const response = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name,
          last_name,
        },
      },
    });

    if (!response.data?.user || response.error) {
      console.error("signUp.error", response.error);
      throw new Error(response?.error?.message || "Failed to create account");
    }

    // Update the is initialized cache
    getIsInitialized._is_initialized_cache = true;

    return {
      id: response.data.user.id,
      email,
      password,
    };
  },
  async salesCreate(body: SalesFormData) {
    const { data, error } = await invokeAuthenticatedEdgeFunction<{
      data: Sale;
    }>("users", {
      method: "POST",
      body,
    });

    if (!data || error) {
      console.error("salesCreate.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(errorDetails?.message || "Failed to create the user");
    }

    return data.data;
  },
  async salesUpdate(
    id: Identifier,
    data: Partial<Omit<SalesFormData, "password">>,
  ) {
    const { email, first_name, last_name, administrator, avatar, disabled } =
      data;

    const { data: updatedData, error } = await invokeAuthenticatedEdgeFunction<{
      data: Sale;
    }>("users", {
      method: "PATCH",
      body: {
        sales_id: id,
        email,
        first_name,
        last_name,
        administrator,
        disabled,
        avatar,
      },
    });

    if (!updatedData || error) {
      console.error("salesCreate.error", error);
      throw new Error("Failed to update account manager");
    }

    return updatedData.data;
  },
  async updatePassword(id: Identifier) {
    const { data: passwordUpdated, error } =
      await invokeAuthenticatedEdgeFunction<boolean>("update_password", {
        method: "PATCH",
        body: {
          sales_id: id,
        },
      });

    if (!passwordUpdated || error) {
      console.error("update_password.error", error);
      throw new Error("Failed to update password");
    }

    return passwordUpdated;
  },
  async isInitialized() {
    return getIsInitialized();
  },
  async getConfiguration(): Promise<ConfigurationContextValue> {
    const { data } = await baseDataProvider.getOne("configuration", { id: 1 });
    return (data?.config as ConfigurationContextValue) ?? {};
  },
  async updateConfiguration(
    config: ConfigurationContextValue,
  ): Promise<ConfigurationContextValue> {
    const { data } = await baseDataProvider.update("configuration", {
      id: 1,
      data: { config },
      previousData: { id: 1 },
    });
    return data.config as ConfigurationContextValue;
  },
  async getCrmSemanticRegistry(): Promise<CrmSemanticRegistry> {
    const config = await this.getConfiguration();
    return buildCrmSemanticRegistry(config);
  },
  async getUnifiedCrmReadContext(): Promise<UnifiedCrmReadContext> {
    return getUnifiedCrmReadContextFromResources();
  },
  async askUnifiedCrmQuestion(
    question: string,
    context: UnifiedCrmReadContext,
    conversationHistory: UnifiedCrmConversationTurn[] = [],
  ): Promise<UnifiedCrmAnswer> {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      throw new Error("Scrivi una domanda prima di inviare la richiesta.");
    }

    const model = await getConfiguredHistoricalAnalysisModel();

    const { data, error } = await invokeAuthenticatedEdgeFunction<{
      data: UnifiedCrmAnswer;
    }>("unified_crm_answer", {
      method: "POST",
      body: {
        context,
        question: trimmedQuestion,
        model,
        conversationHistory,
      },
    });

    if (!data || error) {
      console.error("askUnifiedCrmQuestion.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(
        errorDetails?.message ||
          "Impossibile ottenere una risposta AI sul CRM unificato",
      );
    }

    return data.data;
  },
  async estimateTravelRoute(
    request: TravelRouteEstimateRequest,
  ): Promise<TravelRouteEstimate> {
    const { data, error } = await invokeAuthenticatedEdgeFunction<{
      data: TravelRouteEstimate;
    }>("travel_route_estimate", {
      method: "POST",
      body: request,
    });

    if (!data || error) {
      console.error("estimateTravelRoute.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(
        errorDetails?.message || "Impossibile calcolare la tratta richiesta",
      );
    }

    return data.data;
  },
  async suggestTravelLocations(
    request: TravelRouteLocationSuggestRequest,
  ): Promise<TravelRouteLocationSuggestion[]> {
    const { data, error } = await invokeAuthenticatedEdgeFunction<{
      data: TravelRouteLocationSuggestion[];
    }>("travel_location_suggest", {
      method: "POST",
      body: request,
    });

    if (!data || error) {
      console.error("suggestTravelLocations.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(
        errorDetails?.message || "Impossibile cercare i luoghi richiesti",
      );
    }

    return data.data;
  },
  async getInvoiceImportWorkspace(): Promise<InvoiceImportWorkspace> {
    return getInvoiceImportWorkspaceFromResources();
  },
  async uploadInvoiceImportFiles(
    files: File[],
  ): Promise<InvoiceImportFileHandle[]> {
    return Promise.all(files.map((file) => uploadInvoiceImportFile(file)));
  },
  async generateInvoiceImportDraft(
    request: Omit<GenerateInvoiceImportDraftRequest, "model">,
  ): Promise<InvoiceImportDraft> {
    const model = await getConfiguredInvoiceExtractionModel();

    const { data, error } = await invokeAuthenticatedEdgeFunction<{
      data: InvoiceImportDraft;
    }>("invoice_import_extract", {
      method: "POST",
      body: {
        ...request,
        model,
      },
    });

    if (!data || error) {
      console.error("generateInvoiceImportDraft.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(
        errorDetails?.message ||
          "Impossibile estrarre i dati fattura nella chat AI",
      );
    }

    return data.data;
  },
  async confirmInvoiceImportDraft(
    draft: InvoiceImportDraft,
  ): Promise<InvoiceImportConfirmation> {
    const { data, error } = await invokeAuthenticatedEdgeFunction<{
      data: InvoiceImportConfirmation;
    }>("invoice_import_confirm", {
      method: "POST",
      body: {
        draft,
      },
    });

    if (!data || error) {
      console.error("confirmInvoiceImportDraft.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(
        errorDetails?.message ||
          "Impossibile confermare l'import fatture nel CRM.",
      );
    }

    return data.data;
  },
  async getQuoteStatusEmailContext(
    quoteId: Identifier,
  ): Promise<QuoteStatusEmailContext> {
    return getQuoteStatusEmailContextFromResources(quoteId);
  },
  async getHistoricalAnalyticsContext(): Promise<AnalyticsContext> {
    return getHistoricalAnalyticsContextFromViews();
  },
  async getHistoricalCashInflowContext(): Promise<HistoricalCashInflowContext> {
    return getHistoricalCashInflowContextFromViews();
  },
  async getAnnualOperationsAnalyticsContext(
    year: number,
  ): Promise<AnnualOperationsContext> {
    return getAnnualOperationsContextFromResources(year);
  },
  async generateHistoricalAnalyticsSummary(): Promise<HistoricalAnalyticsSummary> {
    const [context, model] = await Promise.all([
      getHistoricalAnalyticsContextFromViews(),
      getConfiguredHistoricalAnalysisModel(),
    ]);

    const { data, error } = await invokeAuthenticatedEdgeFunction<{
      data: HistoricalAnalyticsSummary;
    }>("historical_analytics_summary", {
      method: "POST",
      body: {
        context,
        model,
      },
    });

    if (!data || error) {
      console.error("generateHistoricalAnalyticsSummary.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(
        errorDetails?.message ||
          "Impossibile generare l'analisi AI dello storico",
      );
    }

    return data.data;
  },
  async generateHistoricalCashInflowSummary(): Promise<HistoricalAnalyticsSummary> {
    const [context, model] = await Promise.all([
      getHistoricalCashInflowContextFromViews(),
      getConfiguredHistoricalAnalysisModel(),
    ]);

    const { data, error } = await invokeAuthenticatedEdgeFunction<{
      data: HistoricalAnalyticsSummary;
    }>("historical_cash_inflow_summary", {
      method: "POST",
      body: {
        context,
        model,
      },
    });

    if (!data || error) {
      console.error("generateHistoricalCashInflowSummary.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(
        errorDetails?.message ||
          "Impossibile generare l'analisi AI degli incassi storici",
      );
    }

    return data.data;
  },
  async generateAnnualOperationsAnalyticsSummary(
    year: number,
  ): Promise<AnnualOperationsAnalyticsSummary> {
    const [context, model] = await Promise.all([
      getAnnualOperationsContextFromResources(year),
      getConfiguredHistoricalAnalysisModel(),
    ]);

    const { data, error } = await invokeAuthenticatedEdgeFunction<{
      data: AnnualOperationsAnalyticsSummary;
    }>("annual_operations_summary", {
      method: "POST",
      body: {
        context,
        model,
      },
    });

    if (!data || error) {
      console.error("generateAnnualOperationsAnalyticsSummary.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(
        errorDetails?.message ||
          "Impossibile generare l'analisi AI della vista Annuale",
      );
    }

    return data.data;
  },
  async askHistoricalAnalyticsQuestion(
    question: string,
  ): Promise<HistoricalAnalyticsAnswer> {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      throw new Error("Scrivi una domanda prima di inviare la richiesta.");
    }

    const [context, model] = await Promise.all([
      getHistoricalAnalyticsContextFromViews(),
      getConfiguredHistoricalAnalysisModel(),
    ]);

    const { data, error } = await invokeAuthenticatedEdgeFunction<{
      data: HistoricalAnalyticsAnswer;
    }>("historical_analytics_answer", {
      method: "POST",
      body: {
        context,
        question: trimmedQuestion,
        model,
      },
    });

    if (!data || error) {
      console.error("askHistoricalAnalyticsQuestion.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(
        errorDetails?.message ||
          "Impossibile ottenere una risposta AI sullo storico",
      );
    }

    return data.data;
  },
  async askHistoricalCashInflowQuestion(
    question: string,
  ): Promise<HistoricalAnalyticsAnswer> {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      throw new Error("Scrivi una domanda prima di inviare la richiesta.");
    }

    const [context, model] = await Promise.all([
      getHistoricalCashInflowContextFromViews(),
      getConfiguredHistoricalAnalysisModel(),
    ]);

    const { data, error } = await invokeAuthenticatedEdgeFunction<{
      data: HistoricalAnalyticsAnswer;
    }>("historical_cash_inflow_answer", {
      method: "POST",
      body: {
        context,
        question: trimmedQuestion,
        model,
      },
    });

    if (!data || error) {
      console.error("askHistoricalCashInflowQuestion.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(
        errorDetails?.message ||
          "Impossibile ottenere una risposta AI sugli incassi storici",
      );
    }

    return data.data;
  },
  async askAnnualOperationsQuestion(
    year: number,
    question: string,
  ): Promise<AnnualOperationsAnalyticsAnswer> {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      throw new Error("Scrivi una domanda prima di inviare la richiesta.");
    }

    const [context, model] = await Promise.all([
      getAnnualOperationsContextFromResources(year),
      getConfiguredHistoricalAnalysisModel(),
    ]);

    const { data, error } = await invokeAuthenticatedEdgeFunction<{
      data: AnnualOperationsAnalyticsAnswer;
    }>("annual_operations_answer", {
      method: "POST",
      body: {
        context,
        question: trimmedQuestion,
        model,
      },
    });

    if (!data || error) {
      console.error("askAnnualOperationsQuestion.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(
        errorDetails?.message ||
          "Impossibile ottenere una risposta AI sulla vista Annuale",
      );
    }

    return data.data;
  },
  async sendQuoteStatusEmail(
    request: QuoteStatusEmailSendRequest,
  ): Promise<QuoteStatusEmailSendResponse> {
    if (request.automatic && request.hasNonTaxableServices) {
      throw new Error(
        "Invio automatico vietato: il flusso include servizi con is_taxable = false.",
      );
    }

    const { data, error } = await invokeAuthenticatedEdgeFunction<{
      data: QuoteStatusEmailSendResponse;
    }>("quote_status_email_send", {
      method: "POST",
      body: request,
    });

    if (!data || error) {
      console.error("sendQuoteStatusEmail.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(
        errorDetails?.message ||
          "Impossibile inviare la mail cliente del preventivo",
      );
    }

    return data.data;
  },
} satisfies DataProvider;

export type CrmDataProvider = typeof dataProviderWithCustomMethods;

const processConfigLogo = async (logo: any): Promise<string> => {
  if (typeof logo === "string") return logo;
  if (logo?.rawFile instanceof File) {
    await uploadToBucket(logo);
    return logo.src;
  }
  return logo?.src ?? "";
};

const lifeCycleCallbacks: ResourceCallbacks[] = [
  {
    resource: "configuration",
    beforeUpdate: async (params) => {
      const config = params.data.config;
      if (config) {
        config.lightModeLogo = await processConfigLogo(config.lightModeLogo);
        config.darkModeLogo = await processConfigLogo(config.darkModeLogo);
      }
      return params;
    },
  },
  {
    resource: "clients",
    beforeSave: async (data: any) => normalizeClientForSave(data),
  },
  {
    resource: "contacts",
    beforeSave: async (data: Contact) => normalizeContactForSave(data),
  },
  {
    resource: "project_contacts",
    beforeSave: async (data: ProjectContact) =>
      normalizeProjectContactForSave(data),
  },
  {
    resource: "client_notes",
    beforeSave: async (data: any, _, __) => {
      if (data.attachments) {
        data.attachments = await Promise.all(
          data.attachments.map((fi: RAFile) => uploadToBucket(fi)),
        );
      }
      return data;
    },
  },
  {
    resource: "sales",
    beforeSave: async (data: Sale, _, __) => {
      if (data.avatar) {
        await uploadToBucket(data.avatar);
      }
      return data;
    },
  },
];

export const dataProvider = withLifecycleCallbacks(
  dataProviderWithCustomMethods,
  lifeCycleCallbacks,
) as CrmDataProvider;

const uploadInvoiceImportFile = async (
  file: File,
): Promise<InvoiceImportFileHandle> => {
  const fileParts = file.name.split(".");
  const fileExt = fileParts.length > 1 ? `.${file.name.split(".").pop()}` : "";
  const filePath = `ai-invoice-imports/${crypto.randomUUID()}${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("attachments")
    .upload(filePath, file);

  if (uploadError) {
    console.error("invoiceImportUpload.error", uploadError);
    throw new Error("Impossibile caricare il file fattura");
  }

  return {
    path: filePath,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };
};

const uploadToBucket = async (fi: RAFile) => {
  if (!fi.src.startsWith("blob:") && !fi.src.startsWith("data:")) {
    if (fi.path) {
      const { error } = await supabase.storage
        .from("attachments")
        .createSignedUrl(fi.path, 60);

      if (!error) {
        return fi;
      }
    }
  }

  const dataContent = fi.src
    ? await fetch(fi.src)
        .then((res) => {
          if (res.status !== 200) {
            return null;
          }
          return res.blob();
        })
        .catch(() => null)
    : fi.rawFile;

  if (dataContent == null) {
    return fi;
  }

  const file = fi.rawFile;
  const fileParts = file.name.split(".");
  const fileExt = fileParts.length > 1 ? `.${file.name.split(".").pop()}` : "";
  const fileName = `${Math.random()}${fileExt}`;
  const filePath = `${fileName}`;
  const { error: uploadError } = await supabase.storage
    .from("attachments")
    .upload(filePath, dataContent);

  if (uploadError) {
    console.error("uploadError", uploadError);
    throw new Error("Failed to upload attachment");
  }

  const { data } = supabase.storage.from("attachments").getPublicUrl(filePath);

  fi.path = filePath;
  fi.src = data.publicUrl;

  const mimeType = file.type;
  fi.type = mimeType;

  return fi;
};
