import { supabaseDataProvider } from "ra-supabase-core";
import {
  withLifecycleCallbacks,
  type DataProvider,
  type GetListParams,
  type Identifier,
  type ResourceCallbacks,
} from "ra-core";
import type {
  ContactNote,
  Deal,
  DealNote,
  RAFile,
  Sale,
  SalesFormData,
  SignUpData,
} from "../../types";
import type { ConfigurationContextValue } from "../../root/ConfigurationContext";
import type {
  GoogleCalendarEvent,
  GoogleConnectionStatus,
  GoogleEmailMessage,
  GooglePreferences,
} from "../../google/types";
import { defaultGooglePreferences } from "../../google/types";
import { getActivityLog } from "../commons/activity";
import { ATTACHMENTS_BUCKET } from "../commons/attachments";
import { getIsInitialized } from "./authProvider";
import { supabase } from "./supabase";

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
});

const processCompanyLogo = async (params: any) => {
  const logo = params.data.logo;

  if (logo?.rawFile instanceof File) {
    await uploadToBucket(logo);
  }

  return {
    ...params,
    data: {
      ...params.data,
      logo,
    },
  };
};

const dataProviderWithCustomMethods = {
  ...baseDataProvider,
  async getList(resource: string, params: GetListParams) {
    if (resource === "companies") {
      return baseDataProvider.getList("companies_summary", params);
    }
    if (resource === "contacts") {
      return baseDataProvider.getList("contacts_summary", params);
    }
    if (resource === "deals" && params.filter?.company_type) {
      const { company_type, ...restFilter } = params.filter;
      const { data: companies } = await baseDataProvider.getList("companies", {
        filter: { type: company_type },
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "id", order: "ASC" },
      });
      const companyIds = companies.map((c) => c.id);
      if (companyIds.length === 0) {
        return { data: [], total: 0 };
      }
      return baseDataProvider.getList("deals", {
        ...params,
        filter: { ...restFilter, "company_id@in": `(${companyIds.join(",")})` },
      });
    }

    return baseDataProvider.getList(resource, params);
  },
  async getOne(resource: string, params: any) {
    if (resource === "companies") {
      return baseDataProvider.getOne("companies_summary", params);
    }
    if (resource === "contacts") {
      return baseDataProvider.getOne("contacts_summary", params);
    }

    return baseDataProvider.getOne(resource, params);
  },

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
    const { data, error } = await supabase.functions.invoke<{ data: Sale }>(
      "users",
      {
        method: "POST",
        body,
      },
    );

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

    const { data: updatedData, error } = await supabase.functions.invoke<{
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
  async salesDelete(id: Identifier) {
    const { data, error } = await supabase.functions.invoke<{ data: Sale }>(
      "users",
      {
        method: "DELETE",
        body: { sales_id: id },
      },
    );

    if (error) {
      console.error("salesDelete.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(errorDetails?.message || "Failed to delete the user");
    }

    return data?.data ?? ({ id } as any);
  },
  async updatePassword(id: Identifier) {
    const { data: passwordUpdated, error } =
      await supabase.functions.invoke<boolean>("update_password", {
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
  async unarchiveDeal(deal: Deal) {
    // get all deals where stage is the same as the deal to unarchive
    const { data: deals } = await baseDataProvider.getList<Deal>("deals", {
      filter: { stage: deal.stage },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "index", order: "ASC" },
    });

    // set index for each deal starting from 1, if the deal to unarchive is found, set its index to the last one
    const updatedDeals = deals.map((d, index) => ({
      ...d,
      index: d.id === deal.id ? 0 : index + 1,
      archived_at: d.id === deal.id ? null : d.archived_at,
    }));

    return await Promise.all(
      updatedDeals.map((updatedDeal) =>
        baseDataProvider.update("deals", {
          id: updatedDeal.id,
          data: updatedDeal,
          previousData: deals.find((d) => d.id === updatedDeal.id),
        }),
      ),
    );
  },
  async getActivityLog(companyId?: Identifier) {
    return getActivityLog(baseDataProvider, companyId);
  },
  async isInitialized() {
    return getIsInitialized();
  },
  async mergeContacts(sourceId: Identifier, targetId: Identifier) {
    const { data, error } = await supabase.functions.invoke("merge_contacts", {
      method: "POST",
      body: { loserId: sourceId, winnerId: targetId },
    });

    if (error) {
      console.error("merge_contacts.error", error);
      throw new Error("Failed to merge contacts");
    }

    return data;
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

  // ── Google Integration ──────────────────────────────────────────
  async getGoogleStatus() {
    const { data, error } = await supabase.functions.invoke<{
      data: GoogleConnectionStatus;
    }>("google-oauth", {
      method: "POST",
      body: { action: "status" },
    });
    if (error) throw new Error("Failed to get Google status");
    return (
      data?.data ?? {
        connected: false,
        email: null,
        scopes: [],
        preferences: defaultGooglePreferences,
      }
    );
  },
  async getGoogleOAuthUrl() {
    const { data, error } = await supabase.functions.invoke<{
      data: { url: string; state: string };
    }>("google-oauth", {
      method: "POST",
      body: { action: "get-auth-url" },
    });
    if (error) throw new Error("Failed to get Google OAuth URL");
    return data!.data;
  },
  async exchangeGoogleOAuthCode(code: string) {
    const { data, error } = await supabase.functions.invoke<{
      data: { connected: boolean; email: string; scopes: string[] };
    }>("google-oauth", {
      method: "POST",
      body: { action: "exchange-code", code },
    });
    if (error) throw new Error("Failed to exchange Google OAuth code");
    return data!.data;
  },
  async disconnectGoogle() {
    const { error } = await supabase.functions.invoke("google-oauth", {
      method: "POST",
      body: { action: "disconnect" },
    });
    if (error) throw new Error("Failed to disconnect Google");
  },
  async revokeGoogle() {
    const { error } = await supabase.functions.invoke("google-oauth", {
      method: "POST",
      body: { action: "revoke" },
    });
    if (error) throw new Error("Failed to revoke Google access");
  },
  async updateGooglePreferences(preferences: GooglePreferences) {
    const { error } = await supabase.functions.invoke("google-oauth", {
      method: "POST",
      body: { action: "update-preferences", preferences },
    });
    if (error) throw new Error("Failed to update Google preferences");
    return preferences;
  },
  async getUpcomingCalendarEvents(params: {
    timeMin: string;
    timeMax: string;
    maxResults?: number;
  }) {
    const { data, error } = await supabase.functions.invoke<{
      data: { events: GoogleCalendarEvent[]; totalResults: number };
    }>("google-calendar", {
      method: "POST",
      body: { action: "list-events", ...params },
    });
    if (error) throw new Error("Failed to fetch calendar events");
    return data!.data;
  },
  async getContactEmails(emails: string[], maxResults?: number) {
    const { data, error } = await supabase.functions.invoke<{
      data: {
        messages: GoogleEmailMessage[];
        nextPageToken: string | null;
        totalEstimate: number;
      };
    }>("google-gmail", {
      method: "POST",
      body: { action: "list-messages", emails, maxResults: maxResults ?? 10 },
    });
    if (error) throw new Error("Failed to fetch contact emails");
    return data!.data;
  },
  async getContactCalendarEvents(
    emails: string[],
    params?: { timeMin?: string; timeMax?: string; maxResults?: number },
  ) {
    const { data, error } = await supabase.functions.invoke<{
      data: { events: GoogleCalendarEvent[]; totalResults: number };
    }>("google-calendar", {
      method: "POST",
      body: { action: "search-by-attendee", emails, ...params },
    });
    if (error) throw new Error("Failed to fetch contact calendar events");
    return data!.data;
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
    resource: "contact_notes",
    beforeSave: async (data: ContactNote, _, __) => {
      if (data.attachments) {
        data.attachments = await Promise.all(
          data.attachments.map((fi) => uploadToBucket(fi)),
        );
      }
      return data;
    },
  },
  {
    resource: "deal_notes",
    beforeSave: async (data: DealNote, _, __) => {
      if (data.attachments) {
        data.attachments = await Promise.all(
          data.attachments.map((fi) => uploadToBucket(fi)),
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
    resource: "contacts",
    beforeGetList: async (params) => {
      return applyFullTextSearch([
        "first_name",
        "last_name",
        "company_name",
        "title",
        "email",
        "phone",
        "background",
      ])(params);
    },
  },
  {
    resource: "companies",
    beforeGetList: async (params) => {
      return applyFullTextSearch([
        "name",
        "phone_number",
        "website",
        "zipcode",
        "city",
        "state_abbr",
      ])(params);
    },
    beforeCreate: async (params) => {
      const createParams = await processCompanyLogo(params);

      return {
        ...createParams,
        data: {
          created_at: new Date().toISOString(),
          ...createParams.data,
        },
      };
    },
    beforeUpdate: async (params) => {
      return await processCompanyLogo(params);
    },
  },
  {
    resource: "contacts_summary",
    beforeGetList: async (params) => {
      return applyFullTextSearch(["first_name", "last_name"])(params);
    },
  },
  {
    resource: "deals",
    beforeGetList: async (params) => {
      return applyFullTextSearch(["name", "category", "description"])(params);
    },
  },
];

export const dataProvider = withLifecycleCallbacks(
  dataProviderWithCustomMethods,
  lifeCycleCallbacks,
) as CrmDataProvider;

/**
 * Normalize a search query: strip diacritics (accents) and trim whitespace.
 * "Clément" → "Clement", "léa" → "lea"
 */
const normalizeSearchQuery = (q: string): string =>
  q
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

/**
 * Columns that have a corresponding `_search` generated column in the DB
 * (lowercase + unaccented). Only these get the extra `_search@ilike` filter.
 */
const SEARCHABLE_COLUMNS = new Set([
  // companies
  "name",
  "city",
  "state_abbr",
  // contacts
  "first_name",
  "last_name",
  "title",
  "background",
  "company_name",
  // deals
  "category",
  "description",
]);

const applyFullTextSearch = (columns: string[]) => (params: GetListParams) => {
  if (!params.filter?.q) {
    return params;
  }
  const { q, ...filter } = params.filter;
  const normalizedQ = normalizeSearchQuery(q);

  // Build OR conditions for a given query term
  const buildConditions = (term: string) =>
    columns.reduce(
      (acc, column) => {
        if (column === "email") return { ...acc, [`email_fts@ilike`]: term };
        if (column === "phone") return { ...acc, [`phone_fts@ilike`]: term };
        const conditions: Record<string, string> = {
          ...acc,
          [`${column}@ilike`]: term,
        };
        // Only add _search filter for columns that have a generated _search column
        if (SEARCHABLE_COLUMNS.has(column)) {
          conditions[`${column}_search@ilike`] = term;
        }
        return conditions;
      },
      {} as Record<string, string>,
    );

  // If query has accents, search with both original and normalized terms
  const orConditions =
    normalizedQ !== q
      ? { ...buildConditions(q), ...buildConditions(normalizedQ) }
      : buildConditions(normalizedQ);

  return {
    ...params,
    filter: {
      ...filter,
      "@or": orConditions,
    },
  };
};

const uploadToBucket = async (fi: RAFile) => {
  if (!fi.src.startsWith("blob:") && !fi.src.startsWith("data:")) {
    // Sign URL check if path exists in the bucket
    if (fi.path) {
      const { error } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
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
    // We weren't able to download the file from its src (e.g. user must be signed in on another website to access it)
    // or the file has no content (not probable)
    // In that case, just return it as is: when trying to download it, users should be redirected to the other website
    // and see they need to be signed in. It will then be their responsibility to upload the file back to the note.
    return fi;
  }

  const file = fi.rawFile;
  const fileParts = file.name.split(".");
  const fileExt = fileParts.length > 1 ? `.${file.name.split(".").pop()}` : "";
  const fileName = `${Math.random()}${fileExt}`;
  const filePath = `${fileName}`;
  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(filePath, dataContent);

  if (uploadError) {
    console.error("uploadError", uploadError);
    throw new Error("Failed to upload attachment");
  }

  const { data } = supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .getPublicUrl(filePath);

  fi.path = filePath;
  fi.src = data.publicUrl;

  // save MIME type
  const mimeType = file.type;
  fi.type = mimeType;

  return fi;
};
