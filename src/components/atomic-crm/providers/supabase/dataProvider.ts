import { supabaseDataProvider } from "ra-supabase-core";
import { defaultPrimaryKeys } from "@raphiniert/ra-data-postgrest";
import {
  withLifecycleCallbacks,
  type DataProvider,
  type Identifier,
  type ResourceCallbacks,
} from "ra-core";
import type {
  Contact,
  ProjectContact,
  RAFile,
  Sale,
  SalesFormData,
  SignUpData,
} from "../../types";
import { normalizeClientForSave } from "../../clients/clientBilling";
import {
  normalizeContactForSave,
  normalizeProjectContactForSave,
} from "../../contacts/contactRecord";
import { checkAndRunWorkflows } from "../../workflows/workflowEngine";
import type { ConfigurationContextValue } from "../../root/ConfigurationContext";
import { getIsInitialized } from "./authProvider";
import { getEdgeFunctionAuthorizationHeaders } from "./edgeFunctions";
import { supabase } from "./supabase";
import { defaultHistoricalAnalysisModel } from "@/lib/analytics/historicalAnalysis";
import { defaultInvoiceExtractionModel } from "@/lib/ai/invoiceExtractionModel";
import { processConfigLogo, uploadToBucket } from "./storageBucket";
import { buildAnalyticsProviderMethods } from "./dataProviderAnalytics";
import { buildAiProviderMethods } from "./dataProviderAi";
import { buildInvoiceImportProviderMethods } from "./dataProviderInvoiceImport";
import { buildCommunicationsProviderMethods } from "./dataProviderCommunications";
import { buildTravelProviderMethods } from "./dataProviderTravel";
import { buildGoogleCalendarProviderMethods } from "./dataProviderGoogleCalendar";
import { buildFiscalRealityProviderMethods } from "./fiscalRealityProvider";

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
    .set("project_financials", ["project_id"])
    .set("client_commercial_position", ["client_id"])
    .set("financial_documents_summary", ["id"]),
});

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

// --- Config getters (shared across feature modules) ---

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

// --- Feature modules ---

const sharedDeps = {
  baseDataProvider: baseDataProvider as DataProvider,
  invokeEdgeFunction: invokeAuthenticatedEdgeFunction,
  getConfiguredHistoricalAnalysisModel,
};

const analyticsMethods = buildAnalyticsProviderMethods(sharedDeps);
const aiMethods = buildAiProviderMethods(sharedDeps);
const invoiceImportMethods = buildInvoiceImportProviderMethods({
  ...sharedDeps,
  getConfiguredInvoiceExtractionModel,
});
const commsMethods = buildCommunicationsProviderMethods({
  baseDataProvider: baseDataProvider as DataProvider,
  invokeEdgeFunction: invokeAuthenticatedEdgeFunction,
});
const travelMethods = buildTravelProviderMethods({
  invokeEdgeFunction: invokeAuthenticatedEdgeFunction,
});
const googleCalendarMethods = buildGoogleCalendarProviderMethods({
  invokeEdgeFunction: invokeAuthenticatedEdgeFunction,
});
const fiscalRealityMethods = buildFiscalRealityProviderMethods();

// --- Core provider: auth, sales, config + assembled feature methods ---

const dataProviderWithCustomMethods = {
  ...baseDataProvider,
  ...analyticsMethods,
  ...aiMethods,
  ...invoiceImportMethods,
  ...commsMethods,
  ...travelMethods,
  ...googleCalendarMethods,
  ...fiscalRealityMethods,

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
      console.error("salesUpdate.error", error);
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
  async getColumnPreferences(resource: string): Promise<string[] | null> {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", `list_columns:${resource}`)
      .maybeSingle();
    if (!data) return null;
    try {
      return JSON.parse(data.value);
    } catch {
      return null;
    }
  },
  async setColumnPreferences(
    resource: string,
    columns: string[],
  ): Promise<void> {
    await supabase.from("settings").upsert(
      {
        key: `list_columns:${resource}`,
        value: JSON.stringify(columns),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
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
} satisfies DataProvider;

export type CrmDataProvider = typeof dataProviderWithCustomMethods;

// --- Workflow trigger callbacks ---

const buildWorkflowCallbacks = (resources: string[]): ResourceCallbacks[] =>
  resources.map((resource) => ({
    resource,
    afterCreate: async (params: any) => {
      checkAndRunWorkflows(dataProviderWithCustomMethods, {
        resource,
        event: "created",
        record: params.data,
      });
      return params;
    },
    afterUpdate: async (params: any) => {
      const event =
        params.previousData?.status !== params.data?.status
          ? "status_changed"
          : "updated";
      checkAndRunWorkflows(dataProviderWithCustomMethods, {
        resource,
        event,
        record: params.data,
        previousData: params.previousData,
      });
      return params;
    },
  }));

// --- Lifecycle callbacks ---

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
  {
    resource: "quotes",
    beforeGetList: async (params) => {
      const q = params.filter?.q;
      if (q) {
        const { q: _removed, ...rest } = params.filter;
        return {
          ...params,
          filter: {
            ...rest,
            "@or": {
              "description@ilike": q,
              "notes@ilike": q,
            },
          },
        };
      }
      return params;
    },
  },
  // --- Google Calendar sync (awaited so the UI gets back google_event_link) ---
  {
    resource: "services",
    afterCreate: async (params: any) => {
      try {
        const result =
          await dataProviderWithCustomMethods.syncServiceToCalendar(
            "create",
            params.data.id,
          );
        if (result) Object.assign(params.data, result);
      } catch (e) {
        console.warn("Calendar sync (create) failed:", e);
      }
      return params;
    },
    afterUpdate: async (params: any) => {
      try {
        const result =
          await dataProviderWithCustomMethods.syncServiceToCalendar(
            "update",
            params.data.id,
          );
        if (result) Object.assign(params.data, result);
      } catch (e) {
        console.warn("Calendar sync (update) failed:", e);
      }
      return params;
    },
    afterDelete: async (params: any) => {
      try {
        await dataProviderWithCustomMethods.syncServiceToCalendar(
          "delete",
          params.id,
        );
      } catch (e) {
        console.warn("Calendar sync (delete) failed:", e);
      }
      return params;
    },
  },
  // --- Workflow triggers ---
  ...buildWorkflowCallbacks([
    "clients",
    "contacts",
    "projects",
    "quotes",
    "services",
    "payments",
    "expenses",
    "client_tasks",
  ]),
];

export const dataProvider = withLifecycleCallbacks(
  dataProviderWithCustomMethods,
  lifeCycleCallbacks,
) as CrmDataProvider;
