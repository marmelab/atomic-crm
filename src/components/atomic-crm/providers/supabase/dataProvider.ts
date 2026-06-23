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
import {
  defaultDarkModeLogo,
  defaultLightModeLogo,
  defaultTitle,
} from "../../root/defaultConfiguration";
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
      // If there's a search query, use the RPC function for fuzzy search
      if (params.filter?.q) {
        const searchTerm = params.filter.q;
        const { data, error } = await supabase.rpc("search_companies", {
          search_term: searchTerm,
          limit_count: params.pagination?.perPage || 25,
        });

        if (error) {
          console.error("search_companies error:", error);
          // Fallback to default search
          return baseDataProvider.getList("companies_summary", params);
        }

        // Transform RPC results to match expected format
        return {
          data: data || [],
          total: data?.length || 0,
        };
      }

      // status_preset: translate quick-filter presets to lead_status OR conditions
      const STATUS_PRESET_MAP: Record<string, string> = {
        hot_leads:
          "lead_status.in.(info_sent,send_info,interested,proposal_sent)",
        active_customers: "lead_status.eq.closed_won",
        under_negotiation: "lead_status.eq.proposal_sent",
        follow_up: "lead_status.in.(contacted,interested,meeting_booked)",
        never_contacted: "lead_status.eq.new,lead_status.is.null",
        no_response: "lead_status.eq.no_response",
        not_interested: "lead_status.in.(not_interested,bad_fit)",
      };

      if (params.filter?.status_preset) {
        const { status_preset, ...rest } = params.filter;
        const orClause = STATUS_PRESET_MAP[status_preset as string];
        const { page, perPage } = params.pagination ?? { page: 1, perPage: 25 };
        const { field, order } = params.sort ?? { field: "name", order: "ASC" };
        const from = (page - 1) * perPage;
        const to = from + perPage - 1;

        let query = supabase
          .from("companies_summary")
          .select("*", { count: "exact" })
          .or(orClause)
          .range(from, to)
          .order(field, { ascending: order === "ASC", nullsFirst: false });

        // Apply any additional filters (size, sector, sales_id, etc.)
        for (const [key, value] of Object.entries(rest)) {
          const atIdx = key.lastIndexOf("@");
          if (atIdx === -1) {
            query = query.eq(key, value) as typeof query;
          } else {
            const col = key.slice(0, atIdx);
            const op = key.slice(atIdx + 1);
            if (op === "eq") query = query.eq(col, value) as typeof query;
            else if (op === "neq")
              query = query.neq(col, value) as typeof query;
            else if (op === "in")
              query = query.in(
                col,
                (value as string).replace(/^\(|\)$/g, "").split(","),
              ) as typeof query;
            else if (op === "ilike")
              query = query.ilike(col, value as string) as typeof query;
            else if (op === "is") query = query.is(col, value) as typeof query;
          }
        }

        const { data, error, count } = await query;
        if (error) {
          console.error("status_preset filter error:", error);
          return baseDataProvider.getList("companies_summary", {
            ...params,
            filter: rest,
          });
        }
        return { data: data ?? [], total: count ?? 0 };
      }

      // Strip any leftover custom filter keys before passing to baseDataProvider
      const {
        status_preset: _status_preset,
        never_contacted: _never_contacted,
        ...cleanFilter
      } = params.filter ?? {};
      return baseDataProvider.getList("companies_summary", {
        ...params,
        filter: cleanFilter,
      });
    }
    if (resource === "contacts") {
      return baseDataProvider.getList("contacts_summary", params);
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

    return baseDataProvider.getOne(resource, params);
  },
  async getMany(resource: string, params: any) {
    if (resource === "companies") {
      return baseDataProvider.getMany("companies_summary", params);
    }
    return baseDataProvider.getMany(resource, params);
  },
  async getManyReference(resource: string, params: any) {
    if (resource === "companies") {
      return baseDataProvider.getManyReference("companies_summary", params);
    }
    return baseDataProvider.getManyReference(resource, params);
  },
  async create(resource: string, params: any) {
    if (resource === "calendar_events") {
      const { data, error } = await supabase.functions.invoke("calendar_sync", {
        method: "POST",
        body: {
          action: "create",
          data: params.data,
        },
      });

      if (error || !data?.data) {
        console.error("calendar_sync create error:", error);
        const errorDetails = await (async () => {
          try {
            return (await error?.context?.json()) ?? {};
          } catch {
            return {};
          }
        })();
        throw new Error(
          errorDetails?.message ||
            error?.message ||
            "Failed to create calendar event",
        );
      }

      return { data: data.data };
    }

    return baseDataProvider.create(resource, params);
  },
  async update(resource: string, params: any) {
    if (resource === "calendar_events") {
      const { data, error } = await supabase.functions.invoke("calendar_sync", {
        method: "POST",
        body: {
          action: "update",
          id: params.id,
          data: params.data,
        },
      });

      if (error || !data?.data) {
        console.error("calendar_sync update error:", error);
        const errorDetails = await (async () => {
          try {
            return (await error?.context?.json()) ?? {};
          } catch {
            return {};
          }
        })();
        throw new Error(
          errorDetails?.message ||
            error?.message ||
            "Failed to update calendar event",
        );
      }

      return { data: data.data };
    }

    return baseDataProvider.update(resource, params);
  },
  async deleteMany(resource: string, params: { ids: Identifier[] }) {
    const tableName =
      resource === "companies"
        ? "companies"
        : resource === "contacts"
          ? "contacts"
          : resource;

    const { error } = await supabase
      .from(tableName)
      .delete()
      .in("id", params.ids);

    if (error) {
      console.error(`deleteMany ${resource} error:`, error);
      throw new Error(error.message);
    }

    return { data: params.ids };
  },

  async delete(resource: string, params: any) {
    if (resource === "calendar_events") {
      const { data, error } = await supabase.functions.invoke("calendar_sync", {
        method: "POST",
        body: {
          action: "delete",
          id: params.id,
        },
      });

      if (error || !data?.data) {
        console.error("calendar_sync delete error:", error);
        const errorDetails = await (async () => {
          try {
            return (await error?.context?.json()) ?? {};
          } catch {
            return {};
          }
        })();
        throw new Error(
          errorDetails?.message ||
            error?.message ||
            "Failed to cancel calendar event",
        );
      }

      return { data: data.data };
    }

    return baseDataProvider.delete(resource, params);
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
    // If no password provided, generate a strong random one.
    // The user will receive a password reset email to set their own.
    const bodyWithPassword = body.password
      ? body
      : {
          ...body,
          password: crypto.randomUUID() + crypto.randomUUID(),
        };
    const { data, error } = await supabase.functions.invoke<{
      data: Sale;
      invite_link?: string | null;
      temporary_password?: string | null;
      existing_user?: boolean;
    }>("users", {
      method: "POST",
      body: bodyWithPassword,
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

    return data;
  },
  async salesUpdate(
    id: Identifier,
    data: Partial<Omit<SalesFormData, "password">>,
  ) {
    const { email, first_name, last_name, administrator, disabled } = data;
    const avatar = data.avatar as RAFile | string | undefined;

    // The avatar arrives from the image editor as a RAFile object containing a
    // local blob URL and the raw File. This sales-specific update path bypasses
    // the `beforeSave` lifecycle hook, so we must upload any newly-selected file
    // to the storage bucket here and send the resulting public URL (as a jsonb
    // object, matching the `avatar` column) to the edge function.
    let avatarToSave:
      | { src?: string; path?: string; title?: string; type?: string }
      | undefined;
    if (avatar && typeof avatar === "object") {
      const uploaded = avatar.rawFile ? await uploadToBucket(avatar) : avatar;
      avatarToSave = {
        src: uploaded.src,
        path: uploaded.path,
        title: uploaded.title,
        type: uploaded.type,
      };
    }

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
        avatar: avatarToSave,
      },
    });

    if (!updatedData || error) {
      console.error("salesCreate.error", error);
      throw new Error("Failed to update account manager");
    }

    return updatedData.data;
  },
  async updatePassword(_id: Identifier, password: string) {
    const { data, error } = await supabase.auth.updateUser({
      password,
    });

    if (!data.user || error) {
      console.error("updatePassword.error", error);
      throw new Error(error?.message || "Failed to update password");
    }

    return true;
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
  async generateQuoteText(quoteId: Identifier) {
    const { data, error } = await supabase.functions.invoke(
      "generate_quote_text",
      {
        method: "POST",
        body: { quote_id: quoteId },
      },
    );
    if (error || !data) {
      throw new Error("Failed to generate quote text");
    }
    return data;
  },
  async generateQuotePdf(quoteId: Identifier) {
    const { data, error } = await supabase.functions.invoke(
      "generate_quote_pdf",
      {
        method: "POST",
        body: { quote_id: quoteId },
      },
    );
    if (error || !data) {
      throw new Error("Failed to generate PDF");
    }
    return data;
  },
  async sendQuoteForSigning(quoteId: Identifier) {
    const { data, error } = await supabase.functions.invoke(
      "send_quote_for_signing",
      {
        method: "POST",
        body: { quote_id: quoteId },
      },
    );
    if (error || !data) {
      throw new Error("Failed to send quote for signing");
    }
    return data;
  },
  /**
   * Save edits to a quote's generated_sections via the single backend
   * write-path (Phase 4). Replaces the legacy pattern of calling
   * `dataProvider.update("quotes", { data: { generated_sections } })`
   * directly, which bypassed the merge rules and status guards in
   * `saveQuoteContent`. Authenticated CRM users only — auth happens
   * at the edge function via UserMiddleware.
   */
  async saveQuoteContent(
    quoteId: Identifier,
    sections: Record<string, unknown>,
  ): Promise<{ success: true; pdf_url: string | null }> {
    const { data, error } = await supabase.functions.invoke(
      "save_quote_content",
      {
        method: "POST",
        body: { quote_id: quoteId, sections },
      },
    );
    if (error || !data) {
      throw new Error("Failed to save quote content");
    }
    return data as { success: true; pdf_url: string | null };
  },
  /**
   * Phase 7: fetch the latest pipeline step row per step_name for a quote.
   *
   * Returns rows sorted by started_at ASC so the UI can render the flow
   * in execution order. Uses a single PostgREST select with no server-
   * side grouping; the latest-per-step projection is done in JS to keep
   * the query trivial and cache-friendly (the table is small per quote,
   * max ~10 rows after one full pipeline run).
   *
   * Reads are authorized via the "Authenticated users can read quote
   * pipeline steps" RLS policy added in migration
   * 20260415140000_quote_pipeline_steps_select_policy.sql.
   */
  async getQuotePipelineSteps(quoteId: Identifier): Promise<
    Array<{
      id: number;
      quote_id: number;
      step_name: string;
      status: "running" | "success" | "failed" | "skipped";
      started_at: string;
      completed_at: string | null;
      duration_ms: number | null;
      error_message: string | null;
      error_details: Record<string, unknown> | null;
      metadata: Record<string, unknown> | null;
    }>
  > {
    const { data, error } = await supabase
      .from("quote_pipeline_steps")
      .select(
        "id, quote_id, step_name, status, started_at, completed_at, duration_ms, error_message, error_details, metadata",
      )
      .eq("quote_id", quoteId)
      .order("started_at", { ascending: true });
    if (error) {
      throw new Error(`Failed to load quote pipeline steps: ${error.message}`);
    }
    return (data ?? []) as Array<{
      id: number;
      quote_id: number;
      step_name: string;
      status: "running" | "success" | "failed" | "skipped";
      started_at: string;
      completed_at: string | null;
      duration_ms: number | null;
      error_message: string | null;
      error_details: Record<string, unknown> | null;
      metadata: Record<string, unknown> | null;
    }>;
  },
  async duplicateQuote(quoteId: Identifier): Promise<{ id: number }> {
    const { data, error } = await supabase.rpc("duplicate_quote", {
      source_quote_id: quoteId,
    });
    if (error) {
      throw new Error("Failed to duplicate quote");
    }
    return { id: data as number };
  },
  async enrichCompany(companyId: Identifier) {
    const { data, error } = await supabase.functions.invoke("enrich_company", {
      method: "POST",
      body: { company_id: companyId },
    });
    if (error || !data) {
      throw new Error("Failed to enrich company");
    }
    return data;
  },
  async importGoogleSheetLeads(params?: {
    source_id?: Identifier;
    batch_size?: number;
    start_row?: number;
    end_row?: number;
  }) {
    const { data, error } = await supabase.functions.invoke(
      "import_google_sheet_leads",
      {
        method: "POST",
        body: params ?? {},
      },
    );
    if (error || !data) {
      throw new Error(error?.message || "Failed to import Google Sheet leads");
    }
    return data;
  },
  async retryLeadImportEnrichment(runId: Identifier) {
    const { data, error } = await supabase.functions.invoke(
      "import_google_sheet_leads",
      {
        method: "POST",
        body: {
          action: "retry_enrichment",
          run_id: runId,
        },
      },
    );
    if (error || !data) {
      throw new Error(error?.message || "Failed to retry import enrichment");
    }
    return data;
  },
  async enrichAllabolag(companyId: Identifier) {
    const { data, error } = await supabase.functions.invoke(
      "enrich_allabolag",
      {
        method: "POST",
        body: { company_id: companyId },
      },
    );
    if (error || !data) {
      throw new Error("Failed to enrich from Allabolag");
    }
    return data;
  },
  async bulkEnrichCompanies(
    companyIds: Identifier[],
    onProgress?: (done: number, total: number) => void,
  ) {
    const CONCURRENCY = 3;
    const results: Array<{
      id: Identifier;
      success: boolean;
      data?: Record<string, unknown>;
      error?: string;
    }> = [];
    let completed = 0;

    // Process in batches of CONCURRENCY
    for (let i = 0; i < companyIds.length; i += CONCURRENCY) {
      const batch = companyIds.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map((id) => this.enrichCompany(id)),
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const id = batch[j];
        completed++;

        if (result.status === "fulfilled") {
          results.push({ id, success: true, data: result.value });
        } else {
          results.push({
            id,
            success: false,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : "Unknown error",
          });
        }
        onProgress?.(completed, companyIds.length);
      }
    }
    return results;
  },
  async triggerAutoScrape(profileId?: Identifier) {
    const { data, error } = await supabase.functions.invoke("auto_scrape", {
      method: "POST",
      body: profileId ? { profile_id: profileId } : {},
    });
    if (error || !data) {
      throw new Error("Failed to run auto scrape");
    }
    return data;
  },
  async analyzeMeeting(params: {
    transcription_id?: Identifier;
    transcription_text?: string;
    calendar_event_id?: Identifier | null;
    contact_id?: Identifier | null;
    company_id?: Identifier | null;
  }) {
    const { data, error } = await supabase.functions.invoke("analyze_meeting", {
      method: "POST",
      body: params,
    });
    if (error || !data) {
      throw new Error("Failed to analyze meeting");
    }
    return data;
  },
  async fetchFirefliesTranscripts(contactId: Identifier) {
    const { data, error } = await supabase.functions.invoke(
      "fetch_fireflies_transcripts",
      {
        method: "POST",
        body: { contact_id: contactId },
      },
    );
    if (error || !data) {
      throw new Error("Failed to fetch Fireflies transcripts");
    }
    return data;
  },
  async importFirefliesTranscript(
    contactId: Identifier,
    firefliesMeetingId: string,
  ) {
    const { data, error } = await supabase.functions.invoke(
      "fetch_fireflies_transcripts",
      {
        method: "POST",
        body: {
          contact_id: contactId,
          import_meeting_id: firefliesMeetingId,
        },
      },
    );
    if (error || !data) {
      throw new Error("Failed to import Fireflies transcript");
    }
    return data;
  },
  async sendEmail(
    templateId: Identifier,
    contactId: Identifier,
  ): Promise<{ message_id: string }> {
    const { data, error } = await supabase.functions.invoke("send_email", {
      method: "POST",
      body: { template_id: templateId, contact_id: contactId },
    });
    if (error || !data) {
      throw new Error("Failed to send email");
    }
    return data;
  },
  async logCall(params: {
    company_id: number;
    contact_id?: number | null;
    call_outcome: string;
    notes?: string | null;
    call_duration_seconds?: number | null;
    followup_date?: string | null;
    followup_note?: string | null;
  }): Promise<{
    call_log_id: number;
    task_id: number | null;
    new_lead_status: string;
  }> {
    const { data, error } = await supabase.rpc(
      "log_call_and_schedule_followup",
      {
        p_company_id: params.company_id,
        p_contact_id: params.contact_id ?? null,
        p_call_outcome: params.call_outcome,
        p_notes: params.notes ?? null,
        p_call_duration_seconds: params.call_duration_seconds ?? null,
        p_followup_date: params.followup_date ?? null,
        p_followup_note: params.followup_note ?? null,
      },
    );
    if (error) {
      throw new Error(error.message || "Failed to log call");
    }
    return data as {
      call_log_id: number;
      task_id: number | null;
      new_lead_status: string;
    };
  },
  async generateFollowupMessage(callLogId: Identifier): Promise<{
    email_subject: string;
    email_body: string;
    sms_text: string;
    contact_id: number | null;
    contact_name: string;
    contact_email: string | null;
    contact_phone: string | null;
  }> {
    const { data, error } = await supabase.functions.invoke(
      "generate_followup_message",
      {
        method: "POST",
        body: { action: "generate", call_log_id: callLogId },
      },
    );
    if (error || !data) {
      throw new Error("Failed to generate follow-up message");
    }
    return data;
  },
  async sendFollowupEmail(params: {
    contact_id: Identifier;
    subject: string;
    body: string;
  }): Promise<{ success: true; email_send_id: number }> {
    const { data, error } = await supabase.functions.invoke(
      "generate_followup_message",
      {
        method: "POST",
        body: {
          action: "send",
          contact_id: params.contact_id,
          subject: params.subject,
          body: params.body,
        },
      },
    );
    if (error || !data) {
      throw new Error("Failed to send follow-up email");
    }
    return data;
  },
  async analyzeWebsite(
    companyId: Identifier,
    options?: {
      window_kind?: "rolling_28d" | "calendar_month";
      start_date?: string;
      end_date?: string;
    },
  ): Promise<{
    success: true;
    snapshot_id: number;
    findings_count: number;
    period: {
      kind: "rolling_28d" | "calendar_month";
      startDate: string;
      endDate: string;
    };
  }> {
    const { data, error } = await supabase.functions.invoke("analyze_website", {
      method: "POST",
      body: { company_id: companyId, ...options },
    });
    if (error || !data) {
      throw new Error("Failed to analyze website");
    }
    return data;
  },
  async generateMonthlyReport(
    companyId: Identifier,
  ): Promise<{ success: true; report_id: number | null; status: string }> {
    const { data, error } = await supabase.functions.invoke(
      "generate_monthly_reports",
      {
        method: "POST",
        body: { company_id: companyId },
      },
    );
    if (error || !data) {
      throw new Error("Failed to generate monthly report");
    }
    return data;
  },
  async sendMonthlyReport(
    reportId: Identifier,
    overrides?: {
      recipient_email?: string;
      recipient_name?: string;
      ai_content?: {
        greeting: string;
        summary: string;
        recommended_action: string;
        upsell_pitch: string;
      };
    },
  ): Promise<{
    success: true;
    report_id: number;
    status: string;
    email_send_id: number | null;
  }> {
    const { data, error } = await supabase.functions.invoke(
      "send_monthly_report",
      {
        method: "POST",
        body: { report_id: reportId, overrides },
      },
    );
    if (error || !data) {
      throw new Error("Failed to send monthly report");
    }
    return data;
  },
  async getMonthlyReportPdf(
    reportId: Identifier,
  ): Promise<{ success: true; signed_url: string; expires_in: number }> {
    const { data, error } = await supabase.functions.invoke(
      "get_monthly_report_pdf",
      {
        method: "POST",
        body: { report_id: reportId },
      },
    );
    if (error || !data) {
      throw new Error("Failed to create report PDF download link");
    }
    return data;
  },
  async expireOverdueQuotes(): Promise<{ affected: number }> {
    const { data, error } = await supabase.rpc("expire_overdue_quotes");
    if (error) {
      throw new Error("Failed to expire overdue quotes");
    }
    return { affected: data as number };
  },
  async getConfiguration(): Promise<ConfigurationContextValue> {
    const { data } = await baseDataProvider.getOne("configuration", { id: 1 });
    return normalizeLegacyBranding(
      (data?.config as ConfigurationContextValue) ?? {},
    );
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

const normalizeLegacyBranding = (
  config: Partial<ConfigurationContextValue>,
): ConfigurationContextValue => {
  const normalized = { ...config } as ConfigurationContextValue;

  if (!normalized.title || normalized.title === "Atomic CRM") {
    normalized.title = defaultTitle;
  }
  if (
    !normalized.darkModeLogo ||
    normalized.darkModeLogo.includes("logo_atomic_crm")
  ) {
    normalized.darkModeLogo = defaultDarkModeLogo;
  }
  if (
    !normalized.lightModeLogo ||
    normalized.lightModeLogo.includes("logo_atomic_crm")
  ) {
    normalized.lightModeLogo = defaultLightModeLogo;
  }

  return normalized;
};

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
    resource: "call_logs",
    afterUpdate: async (result) => {
      const companyId = result.data?.company_id;
      if (!companyId) return result;

      // Recalculate companies.next_followup_date from remaining call logs
      const now = new Date().toISOString();
      const { data: logs } = await supabase
        .from("call_logs")
        .select("followup_date, followup_note")
        .eq("company_id", companyId)
        .not("followup_date", "is", null)
        .gte("followup_date", now)
        .order("followup_date", { ascending: true })
        .limit(1);

      const next = logs?.[0] ?? null;
      await supabase
        .from("companies")
        .update({
          next_followup_date: next?.followup_date ?? null,
          next_action_at: next?.followup_date ?? null,
          next_action_type: next ? "follow_up" : null,
          next_action_note: next?.followup_note ?? null,
        })
        .eq("id", companyId);

      return result;
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
    afterCreate: async (result: any) => {
      const contactId = result.data?.contact_id;
      if (!contactId) return result;
      // Look up contact's company_id
      const { data: contact } = await supabase
        .from("contacts")
        .select("company_id")
        .eq("id", contactId)
        .single();
      if (!contact?.company_id) return result;
      // Only upgrade to 'contacted' if currently new or unset
      await supabase
        .from("companies")
        .update({ lead_status: "contacted" })
        .eq("id", contact.company_id)
        .or("lead_status.eq.new,lead_status.is.null");
      return result;
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
    afterCreate: async (result: any) => {
      const dealId = result.data?.deal_id;
      if (!dealId) return result;
      // Look up deal's company_id
      const { data: deal } = await supabase
        .from("deals")
        .select("company_id")
        .eq("id", dealId)
        .single();
      if (!deal?.company_id) return result;
      // Only upgrade to 'contacted' if currently new or unset
      await supabase
        .from("companies")
        .update({ lead_status: "contacted" })
        .eq("id", deal.company_id)
        .or("lead_status.eq.new,lead_status.is.null");
      return result;
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
  {
    resource: "quotes",
    beforeGetList: async (params) => {
      return applyFullTextSearch(["title"])(params);
    },
    beforeSave: async (data: Record<string, unknown>) => {
      // Strip line_items — they are in a separate table and handled by afterCreate/afterUpdate
      const { line_items: _, ...quoteData } = data;
      return quoteData;
    },
    afterCreate: async (result, _dataProvider) => {
      // Re-fetch the original form data from the create params stored by beforeCreate
      // The line_items were stripped by beforeSave but we stored them via stashLineItems
      const lineItems =
        popLineItems(`create_${result.data.id}`) ??
        popLineItems("pending_create");
      if (lineItems && lineItems.length > 0) {
        await supabase.from("quote_line_items").insert(
          lineItems.map(
            (
              item: {
                description: string;
                quantity: number;
                unit_price: number;
              },
              index: number,
            ) => ({
              quote_id: result.data.id,
              description: item.description,
              quantity: Number(item.quantity),
              unit_price: Number(item.unit_price),
              sort_order: index,
            }),
          ),
        );
      }
      return result;
    },
    beforeCreate: async (params) => {
      // Stash line_items before they get stripped by beforeSave
      stashLineItems("pending_create", params.data.line_items || null);
      return params;
    },
    afterUpdate: async (result) => {
      const lineItems = popLineItems(`update_${result.data.id}`);
      if (lineItems) {
        // Delete existing line items and re-insert
        await supabase
          .from("quote_line_items")
          .delete()
          .eq("quote_id", result.data.id);
        if (lineItems.length > 0) {
          await supabase.from("quote_line_items").insert(
            lineItems.map(
              (
                item: {
                  description: string;
                  quantity: number;
                  unit_price: number;
                },
                index: number,
              ) => ({
                quote_id: result.data.id,
                description: item.description,
                quantity: Number(item.quantity),
                unit_price: Number(item.unit_price),
                sort_order: index,
              }),
            ),
          );
        }
      }
      return result;
    },
    beforeUpdate: async (params) => {
      stashLineItems(`update_${params.id}`, params.data.line_items || null);
      return params;
    },
  },
];

// Keyed storage for line items during create/update lifecycle (avoids race conditions)
const _pendingQuoteLineItemsMap = new Map<
  string,
  Array<{
    description: string;
    quantity: number;
    unit_price: number;
  }>
>();

function stashLineItems(
  key: string,
  lineItems: Array<{
    description: string;
    quantity: number;
    unit_price: number;
  }> | null,
) {
  if (lineItems) {
    _pendingQuoteLineItemsMap.set(key, lineItems);
  }
}

function popLineItems(key: string) {
  const items = _pendingQuoteLineItemsMap.get(key);
  _pendingQuoteLineItemsMap.delete(key);
  return items ?? null;
}

const wrappedDataProvider = withLifecycleCallbacks(
  dataProviderWithCustomMethods,
  lifeCycleCallbacks,
);

// Expose deleteMany directly — withLifecycleCallbacks may intercept it
// and convert to individual delete() calls which can fail silently.
export const dataProvider = {
  ...wrappedDataProvider,
  deleteMany: async (resource: string, params: { ids: Identifier[] }) => {
    const { error } = await supabase
      .from(resource)
      .delete()
      .in("id", params.ids);

    if (error) {
      throw new Error(error.message);
    }

    return { data: params.ids };
  },
} as CrmDataProvider;

const applyFullTextSearch = (columns: string[]) => (params: GetListParams) => {
  if (!params.filter?.q) {
    return params;
  }
  const { q, ...filter } = params.filter;
  return {
    ...params,
    filter: {
      ...filter,
      "@or": columns.reduce((acc, column) => {
        if (column === "email")
          return {
            ...acc,
            [`email_fts@ilike`]: q,
          };
        if (column === "phone")
          return {
            ...acc,
            [`phone_fts@ilike`]: q,
          };
        else
          return {
            ...acc,
            [`${column}@ilike`]: q,
          };
      }, {}),
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
