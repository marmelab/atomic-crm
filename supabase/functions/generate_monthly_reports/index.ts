import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse, createJsonResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  errorResponseFromUnknown,
  getOptionalBooleanField,
  getPositiveIntegerField,
  parseRequiredJsonBody,
} from "../_shared/http.ts";
import {
  DEFAULT_UPSELL_CATALOG,
  selectUpsells,
} from "../_shared/monthlyReport/upsellCatalog.ts";
import { buildMonthlyReportPrompts } from "../_shared/monthlyReport/buildReportPrompt.ts";
import { generateReportContent } from "../_shared/monthlyReport/generateReportContent.ts";
import {
  buildReportEmailHtml,
  CUSTOMER_HIDDEN_FINDING_KEYS,
} from "../_shared/monthlyReport/buildReportEmailHtml.ts";
import { notifyReportDiscord } from "../_shared/monthlyReport/notifyReportDiscord.ts";
import type {
  ReportSnapshot,
  UpsellOffer,
} from "../_shared/monthlyReport/types.ts";
import {
  buildFallbackReportContent,
  buildReportViewModel,
} from "../_shared/monthlyReport/reportViewModel.ts";
import { buildReportPdf } from "../_shared/monthlyReport/buildReportPdf.ts";
import { previousCalendarMonth } from "../_shared/visibilityPeriods.ts";
import { aggregateSearchConsole } from "../_shared/monthlyReport/aggregateSnapshots.ts";

/**
 * Generate Monthly Reports — skapar en DRAFT-månadsrapport per kund (godkännande-
 * grind: mailet skickas av send_monthly_report först efter godkännande).
 *
 * Lägen (samma dubbla auth som analyze_website):
 *   { cron: true }   — alla kunder med delivered_website_url (x-cron-secret),
 *                      körs i bakgrunden, svarar 202
 *   { company_id }   — en kund (knappen på Kund-fliken, user-JWT)
 */

const CRON_BATCH_SIZE = 3;

// --- Helpers ---

function monthLabelSv(periodISO: string): string {
  return new Date(`${periodISO}T00:00:00Z`).toLocaleDateString("sv-SE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const SNAPSHOT_COLUMNS =
  "id, fetched_at, period_start, period_end, window_kind, data_coverage, source_status, performance_score, seo_score, pagespeed, field_data, seo_checks, business_profile, search_console, findings";

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

function monthFirst(periodISO: string): string {
  const d = new Date(`${periodISO}T00:00:00Z`);
  return isoDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}
function monthLast(periodISO: string): string {
  const d = new Date(`${periodISO}T00:00:00Z`);
  return isoDate(
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)),
  );
}
function monthCount(startISO: string, endISO: string): number {
  const s = new Date(`${startISO}T00:00:00Z`);
  const e = new Date(`${endISO}T00:00:00Z`);
  return (
    (e.getUTCFullYear() - s.getUTCFullYear()) * 12 +
    (e.getUTCMonth() - s.getUTCMonth()) +
    1
  );
}
/** Föregående lika långa månadsintervall (för trend-jämförelsen). */
function precedingRange(
  startISO: string,
  months: number,
): { startDate: string; endDate: string } {
  const s = new Date(`${startISO}T00:00:00Z`);
  const endPrev = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 0));
  const startPrev = new Date(
    Date.UTC(endPrev.getUTCFullYear(), endPrev.getUTCMonth() - (months - 1), 1),
  );
  return { startDate: isoDate(startPrev), endDate: isoDate(endPrev) };
}
function periodLabelSv(startISO: string, endISO: string): string {
  return monthFirst(startISO) === monthFirst(endISO)
    ? monthLabelSv(startISO)
    : `${monthLabelSv(startISO)} – ${monthLabelSv(endISO)}`;
}

async function loadMonthSnapshots(
  companyId: number,
  startDate: string,
  endDate: string,
): Promise<ReportSnapshot[]> {
  const { data } = await supabaseAdmin
    .from("website_snapshots")
    .select(SNAPSHOT_COLUMNS)
    .eq("company_id", companyId)
    .eq("window_kind", "calendar_month")
    .gte("period_start", startDate)
    .lte("period_start", endDate)
    .order("period_start", { ascending: true });
  return (data ?? []) as ReportSnapshot[];
}

/**
 * Slår ihop flera månads-snapshots till en syntetisk ReportSnapshot för
 * perioden: GSC aggregeras (B1), medan prestanda/SEO/Business tas från den
 * SENASTE månaden (ögonblicksdata som inte kan historiseras).
 */
function aggregateReportSnapshot(
  snaps: ReportSnapshot[],
  range: { startDate: string; endDate: string },
): ReportSnapshot | null {
  if (snaps.length === 0) return null;
  const sorted = [...snaps].sort((a, b) =>
    (a.period_start ?? "").localeCompare(b.period_start ?? ""),
  );
  const mostRecent = sorted[sorted.length - 1];
  const agg = aggregateSearchConsole(
    sorted.map((s) => s.search_console ?? null),
  );
  return {
    ...mostRecent,
    period_start: range.startDate,
    period_end: range.endDate,
    search_console: (agg ??
      mostRecent.search_console) as ReportSnapshot["search_console"],
  };
}

/** Kundvänd rad om GEO/AI-sök-beredskap ur crawl-data. llms.txt nämns ej. */
function geoReadiness(seoChecks: ReportSnapshot["seo_checks"]): string {
  if (!seoChecks) return "Kunde inte kontrolleras den här perioden.";
  return seoChecks.schema_org
    ? "Strukturerad data finns — bra grund för att AI-tjänster ska förstå er."
    : "Strukturerad data saknas — försvårar för AI-tjänster att förstå och rekommendera er.";
}

async function loadUpsellCatalog(): Promise<UpsellOffer[]> {
  try {
    const { data } = await supabaseAdmin
      .from("configuration")
      .select("config")
      .eq("id", 1)
      .single();
    const catalog = data?.config?.monthlyReport?.upsellCatalog;
    if (Array.isArray(catalog) && catalog.length > 0) {
      return catalog as UpsellOffer[];
    }
  } catch (error) {
    console.warn(
      "generate_monthly_reports: config read failed, using default:",
      error,
    );
  }
  return DEFAULT_UPSELL_CATALOG;
}

/** Primär mottagare: äldsta kontakten med Work-mail, annars första mailet. */
async function resolveRecipient(
  companyId: number,
): Promise<{ email: string | null; name: string | null }> {
  const { data: contacts } = await supabaseAdmin
    .from("contacts")
    .select("first_name, last_name, email_jsonb, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (!contacts || contacts.length === 0) return { email: null, name: null };

  type C = {
    first_name?: string | null;
    last_name?: string | null;
    email_jsonb?: Array<{ email: string; type: string }> | null;
  };
  const nameOf = (c: C) =>
    [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || null;

  for (const contact of contacts as C[]) {
    const work = (contact.email_jsonb ?? []).find((e) => e.type === "Work");
    if (work?.email) return { email: work.email, name: nameOf(contact) };
  }
  for (const contact of contacts as C[]) {
    const any = (contact.email_jsonb ?? [])[0];
    if (any?.email) return { email: any.email, name: nameOf(contact) };
  }
  return { email: null, name: null };
}

// --- Kärna: skapa draft för ett företag ---

async function generateReportForCompany(
  companyId: number,
  source: "manual" | "cron",
  requestedPeriod?: { startDate: string; endDate: string },
): Promise<{ report_id: number | null; status: string }> {
  // Period: vald (normaliserad till hela månader) eller default = förra månaden.
  const reportPeriod = requestedPeriod
    ? {
        startDate: monthFirst(requestedPeriod.startDate),
        endDate: monthLast(requestedPeriod.endDate),
      }
    : (() => {
        const m = previousCalendarMonth();
        return { startDate: m.startDate, endDate: m.endDate };
      })();
  const months = monthCount(reportPeriod.startDate, reportPeriod.endDate);
  const comparisonPeriod = precedingRange(reportPeriod.startDate, months);
  const period = reportPeriod.startDate;
  const periodLabel = periodLabelSv(
    reportPeriod.startDate,
    reportPeriod.endDate,
  );

  // Idempotens per distinkt period (start+slut). Färdig rapport rörs aldrig.
  const { data: existing } = await supabaseAdmin
    .from("monthly_reports")
    .select("id, status")
    .eq("company_id", companyId)
    .eq("data_period_start", reportPeriod.startDate)
    .eq("data_period_end", reportPeriod.endDate)
    .maybeSingle();
  if (
    existing &&
    (existing.status === "sent" || existing.status === "approved")
  ) {
    return { report_id: existing.id, status: "skipped_already_finalized" };
  }

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .single();
  if (!company) throw new Error(`Company ${companyId} not found`);

  // Endast officiella kalendermånad-snapshots är giltiga rapportunderlag.
  // Flera månader aggregeras (B1); jämförelsen är föregående lika långa period.
  const [rangeSnaps, comparisonSnaps] = await Promise.all([
    loadMonthSnapshots(companyId, reportPeriod.startDate, reportPeriod.endDate),
    loadMonthSnapshots(
      companyId,
      comparisonPeriod.startDate,
      comparisonPeriod.endDate,
    ),
  ]);
  const latest = aggregateReportSnapshot(rangeSnaps, reportPeriod);
  const previous = aggregateReportSnapshot(comparisonSnaps, comparisonPeriod);

  const writeRow = async (fields: Record<string, unknown>) => {
    if (existing) {
      const { data, error } = await supabaseAdmin
        .from("monthly_reports")
        .update(fields)
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error) throw new Error(`update monthly_reports: ${error.message}`);
      return data!.id as number;
    }
    const { data, error } = await supabaseAdmin
      .from("monthly_reports")
      .insert({ company_id: companyId, period, ...fields })
      .select("id")
      .single();
    if (error) throw new Error(`insert monthly_reports: ${error.message}`);
    return data!.id as number;
  };

  if (!latest) {
    const id = await writeRow({ status: "skipped", error: "no snapshot" });
    return { report_id: id, status: "skipped_no_snapshot" };
  }

  const recipient = await resolveRecipient(companyId);
  const viewModel = buildReportViewModel({
    companyName: company.name,
    periodLabel,
    latest,
    previous,
  });
  const metrics = viewModel.metrics;
  const catalog = await loadUpsellCatalog();
  const upsells = selectUpsells(
    latest.findings,
    catalog,
    CUSTOMER_HIDDEN_FINDING_KEYS,
  );
  const hasSearchData = !!latest.search_console;

  const { prompt, systemPrompt } = buildMonthlyReportPrompts({
    companyName: company.name,
    contactName: recipient.name,
    periodLabel,
    metrics,
    upsell: upsells[0] ?? null,
    geoReadiness: geoReadiness(latest.seo_checks),
    hasSearchData,
  });

  let content = buildFallbackReportContent(viewModel, recipient.name);
  let aiFallbackReason: string | null = null;
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (apiKey) {
    try {
      const result = await generateReportContent({
        prompt,
        systemPrompt,
        apiKey,
        validation: {
          supabase: supabaseAdmin,
          notifyDiscord: async ({ validationError }) => {
            await notifyReportDiscord({
              title: "Månadsrapport: AI-text underkänd",
              description: `**Kund:** ${company.name}\n**Fel:** ${validationError}`,
              color: 15105570,
            });
          },
        },
      });
      if (result.content) {
        content = result.content;
      } else {
        aiFallbackReason = "AI-svaret klarade inte valideringen";
      }
    } catch (aiError) {
      aiFallbackReason =
        aiError instanceof Error ? aiError.message : String(aiError);
    }
  } else {
    aiFallbackReason = "ANTHROPIC_API_KEY saknas";
  }

  const html = buildReportEmailHtml({
    companyName: company.name,
    periodLabel,
    aiContent: content,
    metrics,
    viewModel,
    hasSearchData,
    replyToEmail: Deno.env.get("RESEND_FROM_EMAIL") || "hej@axonadigital.se",
  });
  const pdfBytes = await buildReportPdf({ viewModel, aiContent: content });
  const pdfPath = `${companyId}/${reportPeriod.startDate}_${reportPeriod.endDate}/synlighetsrapport-v2.pdf`;
  const { error: pdfUploadError } = await supabaseAdmin.storage
    .from("monthly-reports")
    .upload(pdfPath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (pdfUploadError) {
    throw new Error(`PDF upload failed: ${pdfUploadError.message}`);
  }

  const reportId = await writeRow({
    status: "draft",
    snapshot_id: latest.id ?? null,
    previous_snapshot_id: previous?.id ?? null,
    recipient_email: recipient.email,
    recipient_name: recipient.name,
    ai_content: content,
    selected_upsells: upsells,
    metrics,
    view_model: viewModel,
    generated_html: html,
    data_period_start: reportPeriod.startDate,
    data_period_end: reportPeriod.endDate,
    report_version: 2,
    pdf_storage_path: pdfPath,
    pdf_generated_at: new Date().toISOString(),
    error: aiFallbackReason
      ? `AI-reservtext användes: ${aiFallbackReason}`
      : null,
  });

  // Discord-grind: "Granska & skicka" → CRM:t. Varningsfärg vid negativ huvudtrend.
  const crmUrl =
    Deno.env.get("CRM_PUBLIC_URL") ||
    Deno.env.get("SITE_URL") ||
    "http://localhost:5173";
  const clicksDelta = metrics.clicks.deltaPct;
  const negative = clicksDelta != null && clicksDelta < 0;
  const recipientLine = recipient.email
    ? recipient.email
    : "⚠️ ingen kontakt-email hittad";

  await notifyReportDiscord(
    {
      title: `Månadsrapport redo: ${company.name}`,
      description:
        `**Period:** ${periodLabel}\n` +
        `**Mottagare:** ${recipientLine}\n` +
        `**Föreslagen upsell:** ${upsells[0]?.label ?? "ingen"}\n` +
        (aiFallbackReason
          ? `ℹ️ **Reservtext användes:** ${aiFallbackReason.slice(0, 120)}\n`
          : "") +
        (negative
          ? `⚠️ **Klick ned ${Math.round(clicksDelta!)}% mot förra månaden — granska tonen.**`
          : ""),
      color: negative ? 15105570 : 3066993, // amber vid negativ trend, annars grön
    },
    [
      {
        label: "Granska & skicka i CRM",
        url: `${crmUrl}/#/companies/${companyId}/show`,
      },
    ],
  );

  return {
    report_id: reportId,
    status: source === "cron" ? "draft_cron" : "draft",
  };
}

// --- Cron-svep ---

async function runCronSweep(): Promise<void> {
  const { data: customers, error } = await supabaseAdmin
    .from("customer_details")
    .select("company_id")
    .not("delivered_website_url", "is", null);
  if (error || !customers) {
    console.error(
      "generate_monthly_reports cron: could not list customers",
      error,
    );
    return;
  }
  console.warn(`generate_monthly_reports cron: ${customers.length} customers`);
  for (let i = 0; i < customers.length; i += CRON_BATCH_SIZE) {
    const batch = customers.slice(i, i + CRON_BATCH_SIZE);
    await Promise.all(
      batch.map((row) =>
        generateReportForCompany(row.company_id, "cron").catch((err) =>
          console.error(
            `generate_monthly_reports cron: company ${row.company_id} failed:`,
            err,
          ),
        ),
      ),
    );
  }
  console.warn("generate_monthly_reports cron: sweep complete");
}

// --- Main handler (samma dubbla auth-läge som analyze_website) ---

const isCronAuthorized = (req: Request) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret =
    req.headers.get("x-cron-secret") ||
    new URL(req.url).searchParams.get("secret");
  return !!cronSecret && providedSecret === cronSecret;
};

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    (isCronAuthorized(req)
      ? (next: () => Promise<Response>) => next()
      : (next: () => Promise<Response>) =>
          AuthMiddleware(req, async (req) =>
            UserMiddleware(req, async () => next()),
          ))(async () => {
      if (req.method !== "POST") {
        return createErrorResponse(405, "Method Not Allowed");
      }
      try {
        const body = await parseRequiredJsonBody(req);
        const cron = getOptionalBooleanField(body, "cron");

        if (cron) {
          const sweep = runCronSweep();
          if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
            EdgeRuntime.waitUntil(sweep);
          } else {
            await sweep;
          }
          return createJsonResponse({ accepted: true }, { status: 202 });
        }

        const company_id = getPositiveIntegerField(body, "company_id", {
          required: true,
        });
        const periodStart = (body as { period_start?: unknown }).period_start;
        const periodEnd = (body as { period_end?: unknown }).period_end;
        const requestedPeriod =
          typeof periodStart === "string" && typeof periodEnd === "string"
            ? { startDate: periodStart, endDate: periodEnd }
            : undefined;
        const result = await generateReportForCompany(
          company_id as number,
          "manual",
          requestedPeriod,
        );
        return createJsonResponse({ success: true, ...result });
      } catch (error) {
        return errorResponseFromUnknown(error);
      }
    }),
  ),
);
