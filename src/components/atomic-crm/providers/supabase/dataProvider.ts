import { supabaseDataProvider } from "ra-supabase-core";
import {
  withLifecycleCallbacks,
  type DataProvider,
  type GetListParams,
  type Identifier,
  type ResourceCallbacks,
} from "ra-core";
import type {
  AttachmentNote,
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
import { getSupabaseClient } from "./supabase";

const getBaseDataProvider = () =>
  supabaseDataProvider({
    instanceUrl: import.meta.env.VITE_SUPABASE_URL,
    apiKey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
    supabaseClient: getSupabaseClient(),
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

const getDataProviderWithCustomMethods = () => {
  const baseDataProvider = getBaseDataProvider();

  return {
    ...baseDataProvider,
    async getList(resource: string, params: GetListParams) {
      if (resource === "companies") {
        const searchParams = applyFullTextSearch([
          "name",
          "phone_number",
          "website",
          "zipcode",
          "city",
          "state_abbr",
        ])(params);
        return baseDataProvider.getList("companies_summary", searchParams);
      }
      if (resource === "contacts" || resource === "contacts_summary") {
        const searchParams = applyFullTextSearch([
          "first_name",
          "last_name",
          "company_name",
          "title",
          "email",
          "phone",
          "background",
        ])(params);
        return baseDataProvider.getList("contacts_summary", searchParams);
      }
      if (resource === "deals") {
        // Apply full-text search transformation here (not via a lifecycle
        // callback) so the `@or` filter is guaranteed to be present when we
        // forward the call to `deals_summary`. Relying on a `beforeGetList`
        // callback registered on `"deals"` was fragile because the redirect
        // below changes the effective resource and could cause the `q` filter
        // to be dropped before reaching PostgREST.
        const searchParams = applyFullTextSearch([
          "name",
          "company_name",
          "contact_names",
          "category",
          "description",
        ])(params);
        // Pull the bare `company_type` out of the filter. It comes from
        // `DealListForView`'s permanent filter when a custom view declares a
        // company type. Any other shape (`company_type@is`, `company_type@eq`,
        // ...) is left alone and forwarded as-is to PostgREST.
        //
        // Critically, we must DROP the key when its value is falsy
        // (undefined / null / empty string). Otherwise ra-data-postgrest
        // would serialize it as `company_type=eq.undefined` (or `eq.null`,
        // `eq.`), which PostgREST interprets as a literal string comparison
        // and silently returns zero rows — breaking the search box on any
        // custom view that omits `companyType`.
        const { company_type, ...restFilter } = searchParams.filter ?? {};
        const finalFilter = company_type
          ? { ...restFilter, "company_type@eq": company_type }
          : restFilter;
        return baseDataProvider.getList("deals_summary", {
          ...searchParams,
          filter: finalFilter,
        });
      }
      if (resource === "activity_log") {
        const { data, total } = await baseDataProvider.getList(
          "activity_log",
          params,
        );
        // Rename snake_case view columns to camelCase to match Activity type
        return {
          data: data.map((row: any) => ({
            ...row,
            contactNote: row.contact_note ?? undefined,
            dealNote: row.deal_note ?? undefined,
            contact_note: undefined,
            deal_note: undefined,
          })),
          total,
        };
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
      if (resource === "deals") {
        return baseDataProvider.getOne("deals_summary", params);
      }

      return baseDataProvider.getOne(resource, params);
    },

    async signUp({ email, password, first_name, last_name }: SignUpData) {
      const response = await getSupabaseClient().auth.signUp({
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
      const { data, error } = await getSupabaseClient().functions.invoke<{
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

      const { data: updatedData, error } =
        await getSupabaseClient().functions.invoke<{
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
      const { data, error } = await getSupabaseClient().functions.invoke<{
        data: Sale;
      }>("users", {
        method: "DELETE",
        body: { sales_id: id },
      });

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
        await getSupabaseClient().functions.invoke<boolean>("update_password", {
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
      const { data, error } = await getSupabaseClient().functions.invoke(
        "merge_contacts",
        {
          method: "POST",
          body: { loserId: sourceId, winnerId: targetId },
        },
      );

      if (error) {
        console.error("merge_contacts.error", error);
        throw new Error("Failed to merge contacts");
      }

      return data;
    },
    async getConfiguration(): Promise<ConfigurationContextValue> {
      const { data } = await baseDataProvider.getOne("configuration", {
        id: 1,
      });
      const config = (data?.config as ConfigurationContextValue) ?? {};
      // This call goes through the bare base provider, so the `afterRead`
      // lifecycle hook on `configuration` is bypassed. Resolve logos
      // manually so the bootstrap path (CRM.tsx, useConfigurationLoader)
      // doesn't end up rendering expired or unsigned storage paths.
      if (config.lightModeLogo != null) {
        config.lightModeLogo = await resolveConfigLogo(config.lightModeLogo);
      }
      if (config.darkModeLogo != null) {
        config.darkModeLogo = await resolveConfigLogo(config.darkModeLogo);
      }
      return config;
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
      const { data, error } = await getSupabaseClient().functions.invoke<{
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
      const { data, error } = await getSupabaseClient().functions.invoke<{
        data: { url: string; state: string };
      }>("google-oauth", {
        method: "POST",
        body: { action: "get-auth-url" },
      });
      if (error) throw new Error("Failed to get Google OAuth URL");
      return data!.data;
    },
    async exchangeGoogleOAuthCode(code: string) {
      const { data, error } = await getSupabaseClient().functions.invoke<{
        data: { connected: boolean; email: string; scopes: string[] };
      }>("google-oauth", {
        method: "POST",
        body: { action: "exchange-code", code },
      });
      if (error) throw new Error("Failed to exchange Google OAuth code");
      return data!.data;
    },
    async disconnectGoogle() {
      const { error } = await getSupabaseClient().functions.invoke(
        "google-oauth",
        {
          method: "POST",
          body: { action: "disconnect" },
        },
      );
      if (error) throw new Error("Failed to disconnect Google");
    },
    async revokeGoogle() {
      const { error } = await getSupabaseClient().functions.invoke(
        "google-oauth",
        {
          method: "POST",
          body: { action: "revoke" },
        },
      );
      if (error) throw new Error("Failed to revoke Google access");
    },
    async updateGooglePreferences(preferences: GooglePreferences) {
      const { error } = await getSupabaseClient().functions.invoke(
        "google-oauth",
        {
          method: "POST",
          body: { action: "update-preferences", preferences },
        },
      );
      if (error) throw new Error("Failed to update Google preferences");
      return preferences;
    },
    async getUpcomingCalendarEvents(params: {
      timeMin: string;
      timeMax: string;
      maxResults?: number;
    }) {
      const { data, error } = await getSupabaseClient().functions.invoke<{
        data: { events: GoogleCalendarEvent[]; totalResults: number };
      }>("google-calendar", {
        method: "POST",
        body: { action: "list-events", ...params },
      });
      if (error) throw new Error("Failed to fetch calendar events");
      return data!.data;
    },
    async getContactEmails(emails: string[], maxResults?: number) {
      const { data, error } = await getSupabaseClient().functions.invoke<{
        data: {
          messages: GoogleEmailMessage[];
          nextPageToken: string | null;
          totalEstimate: number;
        };
      }>("google-gmail", {
        method: "POST",
        body: {
          action: "list-messages",
          emails,
          maxResults: maxResults ?? 10,
        },
      });
      if (error) throw new Error("Failed to fetch contact emails");
      return data!.data;
    },
    async getContactCalendarEvents(
      emails: string[],
      params?: { timeMin?: string; timeMax?: string; maxResults?: number },
    ) {
      const { data, error } = await getSupabaseClient().functions.invoke<{
        data: { events: GoogleCalendarEvent[]; totalResults: number };
      }>("google-calendar", {
        method: "POST",
        body: { action: "search-by-attendee", emails, ...params },
      });
      if (error) throw new Error("Failed to fetch contact calendar events");
      return data!.data;
    },
  } satisfies DataProvider;
};

export type CrmDataProvider = ReturnType<
  typeof getDataProviderWithCustomMethods
>;

/**
 * Persists a configuration logo and returns the storage path (or external
 * URL) that should be stored in the JSONB column.
 *
 * The previous implementation returned `logo.src`, which after the
 * private-bucket migration is a 1h signed URL — that would expire in the
 * database within an hour. We instead persist the durable storage `path`
 * for uploaded files, and let the `afterRead` lifecycle hook on
 * `configuration` mint a fresh signed URL on every read.
 *
 * Heuristic for the returned string:
 *   * empty / nullish input → empty string
 *   * existing string already in the DB → returned untouched (could be an
 *     external URL, a legacy public attachments URL, or a new path; the
 *     read-side resolver knows how to handle each case).
 *   * RAFile with a rawFile → upload, return its newly assigned `path`.
 *   * RAFile without rawFile → return `path` if known, else fall back to
 *     `src` (legacy records).
 */
const processConfigLogo = async (logo: any): Promise<string> => {
  if (logo == null) return "";
  if (typeof logo === "string") return logo;
  if (logo?.rawFile instanceof File) {
    await uploadToBucket(logo);
    return logo.path ?? logo.src ?? "";
  }
  return logo?.path ?? logo?.src ?? "";
};

/**
 * Resolves a configuration logo (stored as a plain string) to a URL the
 * browser can render.
 *
 * Distinguishes three cases:
 *   1. external URL (gravatar, favicon CDN, ...) → returned as-is.
 *   2. legacy public attachments URL → extract path, mint signed URL.
 *   3. new bare storage path → mint signed URL directly.
 */
const resolveConfigLogo = async (value: unknown): Promise<string> => {
  if (typeof value !== "string" || value === "") return "";
  if (value.startsWith("data:")) return value;
  if (/^https?:\/\//i.test(value)) {
    // Could be an external URL OR a legacy public-attachments URL.
    const path = getAttachmentStoragePath({ src: value });
    if (!path) return value;
    const signed = await signAttachmentUrl(path);
    return signed ?? value;
  }
  // Bare path → sign directly.
  const signed = await signAttachmentUrl(value);
  return signed ?? value;
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
    afterRead: async (record) => {
      if (record?.config) {
        record.config.lightModeLogo = await resolveConfigLogo(
          record.config.lightModeLogo,
        );
        record.config.darkModeLogo = await resolveConfigLogo(
          record.config.darkModeLogo,
        );
      }
      return record;
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
    afterRead: async (record) => {
      await resolveRecordAttachments(record);
      return record;
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
    afterRead: async (record) => {
      await resolveRecordAttachments(record);
      return record;
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
    afterRead: async (record) => {
      await resolveRecordAttachments(record);
      return record;
    },
  },
  {
    resource: "companies",
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
    // Resolve company.logo to a fresh signed URL on every read. Lifecycle
    // hooks fire on the wrapper resource argument ("companies"), not on the
    // underlying view ("companies_summary") that the custom getList/getOne
    // forwards to, so we register here.
    afterRead: async (record) => {
      await resolveRecordAttachments(record);
      return record;
    },
  },
];

export const getDataProvider = () => {
  if (import.meta.env.VITE_SUPABASE_URL === undefined) {
    throw new Error("Please set the VITE_SUPABASE_URL environment variable");
  }
  if (import.meta.env.VITE_SB_PUBLISHABLE_KEY === undefined) {
    throw new Error(
      "Please set the VITE_SB_PUBLISHABLE_KEY environment variable",
    );
  }
  return withLifecycleCallbacks(
    getDataProviderWithCustomMethods(),
    lifeCycleCallbacks,
  ) as CrmDataProvider;
};

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
 * Normalize for _search columns: also strip spaces so "SoClinic" matches "So Clinic".
 */
const normalizeForSearchColumn = (q: string): string =>
  normalizeSearchQuery(q).replace(/\s+/g, "");

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
  "contact_names",
]);

const applyFullTextSearch = (columns: string[]) => (params: GetListParams) => {
  if (!params.filter?.q) {
    return params;
  }
  const { q, ...filter } = params.filter;
  const normalizedQ = normalizeSearchQuery(q);
  const spacelessQ = normalizeForSearchColumn(q);

  // Build OR conditions for a given query term
  const buildConditions = (term: string, searchColumnTerm: string) =>
    columns.reduce(
      (acc, column) => {
        if (column === "email") return { ...acc, [`email_fts@ilike`]: term };
        if (column === "phone") return { ...acc, [`phone_fts@ilike`]: term };
        const conditions: Record<string, string> = {
          ...acc,
          [`${column}@ilike`]: term,
        };
        // _search columns strip spaces, so match with spaceless term
        if (SEARCHABLE_COLUMNS.has(column)) {
          conditions[`${column}_search@ilike`] = searchColumnTerm;
        }
        return conditions;
      },
      {} as Record<string, string>,
    );

  // If query has accents, search with both original and normalized terms
  const orConditions =
    normalizedQ !== q
      ? {
          ...buildConditions(q, spacelessQ),
          ...buildConditions(normalizedQ, spacelessQ),
        }
      : buildConditions(normalizedQ, spacelessQ);

  return {
    ...params,
    filter: {
      ...filter,
      "@or": orConditions,
    },
  };
};

// How long signed URLs minted for the attachments bucket remain valid.
// One hour is enough for a normal session of viewing notes / images and
// short enough that a leaked URL stops working quickly. Re-signing happens
// transparently on every read via the lifecycle callbacks below.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Builds a fresh, short-lived signed URL for an attachment stored in the
 * private `attachments` bucket.
 *
 * Returns `null` when the storage path cannot be resolved (legacy record
 * with neither `path` nor a recognizable storage URL in `src`, or storage
 * itself errored). Callers must keep the original `src` in that case so
 * external URLs (gravatar, favicons, ...) keep working.
 */
const signAttachmentUrl = async (
  storagePath: string,
): Promise<string | null> => {
  const { data, error } = await getSupabaseClient()
    .storage.from(ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.warn("Failed to sign attachment URL", { storagePath, error });
    return null;
  }
  return data.signedUrl;
};

/**
 * Returns the storage path for a file that lives in the `attachments`
 * bucket, or `null` if it does not (e.g. external URL like gravatar.com).
 *
 * Strategy:
 *   1. Prefer the explicit `path` set by `uploadToBucket` for new uploads.
 *   2. For legacy records persisted before we stopped storing public URLs,
 *      parse the `src` and extract the trailing path segment.
 */
const getAttachmentStoragePath = (file: Partial<RAFile>): string | null => {
  if (file.path) return file.path;
  if (!file.src) return null;
  // Match both legacy public URLs and previously-signed URLs:
  //   /storage/v1/object/public/attachments/<path>
  //   /storage/v1/object/sign/attachments/<path>?token=...
  const match = file.src.match(
    /\/storage\/v1\/object\/(?:public|sign|authenticated)\/attachments\/([^?]+)/,
  );
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

/**
 * Resolves an attachment in place: replaces `src` with a fresh signed URL
 * derived from its storage path, leaving external URLs untouched.
 */
const resolveAttachmentInPlace = async <T extends Partial<RAFile>>(
  file: T | null | undefined,
): Promise<T | null | undefined> => {
  if (!file) return file;
  const storagePath = getAttachmentStoragePath(file);
  if (!storagePath) return file;
  const signedUrl = await signAttachmentUrl(storagePath);
  if (signedUrl) {
    file.src = signedUrl;
    if (!file.path) file.path = storagePath;
  }
  return file;
};

/**
 * Resolves every attachment of a single record (note, sale, ...). Mutates
 * the record in place to keep the lifecycle hooks lightweight.
 */
const resolveRecordAttachments = async (record: any): Promise<void> => {
  if (!record) return;
  if (Array.isArray(record.attachments)) {
    await Promise.all(
      record.attachments.map((attachment: AttachmentNote) =>
        resolveAttachmentInPlace(attachment),
      ),
    );
  }
  if (record.avatar) {
    await resolveAttachmentInPlace(record.avatar);
  }
  if (record.logo) {
    await resolveAttachmentInPlace(record.logo);
  }
};

const uploadToBucket = async (fi: RAFile) => {
  if (!fi.src.startsWith("blob:") && !fi.src.startsWith("data:")) {
    // Already-uploaded file: nothing to do, the read-side lifecycle hook
    // will mint a fresh signed URL on the next fetch.
    if (fi.path) {
      return fi;
    }
    // Legacy record without `path`: derive it from the persisted URL when
    // possible so future reads can re-sign without re-uploading.
    const derivedPath = getAttachmentStoragePath(fi);
    if (derivedPath) {
      fi.path = derivedPath;
      return fi;
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
  // Use crypto.randomUUID() instead of Math.random(): the previous scheme
  // produced filenames like `0.123456789.pdf` with only ~52 bits of entropy,
  // which made the bucket vulnerable to URL enumeration when it was public.
  const fileName = `${crypto.randomUUID()}${fileExt}`;
  const filePath = `${fileName}`;
  const { error: uploadError } = await getSupabaseClient()
    .storage.from(ATTACHMENTS_BUCKET)
    .upload(filePath, dataContent);

  if (uploadError) {
    console.error("uploadError", uploadError);
    throw new Error("Failed to upload attachment");
  }

  fi.path = filePath;

  // Mint a short-lived signed URL so the freshly uploaded file is
  // immediately viewable in the form. Subsequent fetches go through the
  // afterRead lifecycle hooks which always re-sign.
  const signedUrl = await signAttachmentUrl(filePath);
  if (signedUrl) {
    fi.src = signedUrl;
  }

  // save MIME type
  const mimeType = file.type;
  fi.type = mimeType;

  return fi;
};
