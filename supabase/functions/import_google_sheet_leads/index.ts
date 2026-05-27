import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as jose from "jsr:@panva/jose@6";
import { OptionsMiddleware } from "../_shared/cors.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import {
  errorResponseFromUnknown,
  getEnumField,
  getPositiveIntegerField,
  parseOptionalJsonBody,
} from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse, createJsonResponse } from "../_shared/utils.ts";

const RUNNING_STALE_MINUTES = 30;
const ENRICH_DELAY_MS = 300;
const MAX_BATCH_SIZE = 1000;
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const GOOGLE_SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
const SHEET_STATUS_COLUMNS = [
  "crm_import_status",
  "crm_imported_at",
  "crm_import_run_id",
  "crm_company_id",
] as const;

type TriggeredBy = "manual" | "scheduled";
type WritebackStatus = "not_attempted" | "success" | "partial" | "failed";

type ServiceAccountConfig = {
  client_email: string;
  private_key: string;
  token_uri: string;
};

type ImportFilterConfig = {
  min_revenue_kkr?: number | null;
  exclude_holding?: boolean;
  exclude_name_keywords?: string[];
  exclude_org_forms?: string[];
  min_employees?: number | null;
  max_employees?: number | null;
  include_verksamhet_keywords?: string[];
  exclude_verksamhet_keywords?: string[];
  pre_qualify_website?: boolean;
};

type LeadImportSource = {
  id: number;
  name: string;
  source_type: "google_sheet_csv";
  sheet_url: string;
  sheet_gid: string | null;
  is_active: boolean;
  batch_size_default: number;
  last_imported_row: number;
  last_successful_run_at: string | null;
  last_run_status: "idle" | "running" | "success" | "partial" | "failed";
  last_run_message: string | null;
  filter_config: ImportFilterConfig;
};

type LeadImportRun = {
  id: number;
  source_id: number;
  triggered_by: TriggeredBy;
  requested_batch_size: number;
  actual_batch_size: number;
  started_at: string;
  finished_at: string | null;
  rows_scanned: number;
  rows_inserted: number;
  rows_skipped_duplicates: number;
  rows_failed: number;
  sheet_writeback_status: WritebackStatus;
  sheet_rows_marked: number;
  sheet_rows_failed: number;
  sheet_writeback_error: string | null;
  status: "running" | "success" | "partial" | "failed";
  error_summary: string | null;
  imported_company_ids: number[];
};

type ParsedSheetRow = {
  sourceRowNumber: number;
  rowRecord: Record<string, string>;
  company: {
    name: string;
    org_number: string;
    address: string | null;
    zipcode: string | null;
    city: string | null;
    state_abbr: string;
    country: string;
    description: string | null;
    source: "import";
    lead_status: "new";
    pipeline_state: "new";
    data_quality_status: "missing_contact";
    email?: string | null;
    prospecting_status: "imported";
    source_row_number: number;
    processing_order: number;
    import_source_id: number;
    import_run_id: number;
    enrichment_data: Record<string, unknown>;
  };
};

type ProcessedRowResult = {
  sourceRowNumber: number;
  status: "imported" | "duplicate" | "failed" | "filtered" | "prequalified";
  companyId: number | null;
  importedAt: string | null;
};

type RowStats = {
  scanned: number[];
  imported: number[];
  duplicates: number[];
  failed: number[];
  prequalified: number[];
};

type SheetWritebackResult = {
  status: WritebackStatus;
  rows_marked: number;
  rows_failed: number;
  error?: string | null;
};

const SWEDISH_COUNTY_CODES: Record<string, string> = {
  stockholm: "AB",
  stockholms_lan: "AB",
  uppsala: "C",
  uppsala_lan: "C",
  sodermanland: "D",
  sodermanlands_lan: "D",
  ostergotland: "E",
  ostergotlands_lan: "E",
  jonkoping: "F",
  jonkopings_lan: "F",
  kronoberg: "G",
  kronobergs_lan: "G",
  kalmar: "H",
  kalmar_lan: "H",
  gotland: "I",
  gotlands_lan: "I",
  blekinge: "K",
  blekinge_lan: "K",
  skane: "M",
  skane_lan: "M",
  halland: "N",
  hallands_lan: "N",
  vastra_gotaland: "O",
  vastra_gotalands_lan: "O",
  varmland: "S",
  varmlands_lan: "S",
  orebro: "T",
  orebro_lan: "T",
  vastmanland: "U",
  vastmanlands_lan: "U",
  dalarna: "W",
  dalarnas_lan: "W",
  gavleborg: "X",
  gavleborgs_lan: "X",
  vasternorrland: "Y",
  vasternorrlands_lan: "Y",
  jamtland: "Z",
  jamtlands_lan: "Z",
  vasterbotten: "AC",
  vasterbottens_lan: "AC",
  norrbotten: "BD",
  norrbottens_lan: "BD",
};

function parseSwedishNumber(value: string | undefined): number | null {
  if (!value) return null;
  // Handle Swedish formatting: "1 234 567" or "1.234.567" or "1234567"
  const cleaned = value
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

type FilterResult = { skip: true; reason: string } | { skip: false };

function applyImportFilters(
  row: Record<string, string>,
  config: ImportFilterConfig,
): FilterResult {
  const orgForm = (
    row.organisationsform ||
    row.organisations_form ||
    row.org_form ||
    ""
  )
    .trim()
    .toLowerCase();

  const companyName = (
    row.namn ||
    row.name ||
    row.foretagsnamn ||
    ""
  ).toLowerCase();

  // Exclude holding companies by org form
  if (config.exclude_holding && orgForm.includes("holding")) {
    return { skip: true, reason: "holding organisationsform" };
  }

  // Exclude by org form list
  if (config.exclude_org_forms?.length) {
    const matched = config.exclude_org_forms.find((f) =>
      orgForm.includes(f.toLowerCase()),
    );
    if (matched) return { skip: true, reason: `org form "${matched}"` };
  }

  // Exclude by name keywords
  if (config.exclude_name_keywords?.length) {
    const matched = config.exclude_name_keywords.find((kw) =>
      companyName.includes(kw.toLowerCase()),
    );
    if (matched) return { skip: true, reason: `name keyword "${matched}"` };
  }

  // Revenue filter (sheet column in kkr)
  if (config.min_revenue_kkr != null) {
    const rawRevenue =
      row.omsattning ||
      row.omsättning ||
      row.omsattning_tkr ||
      row.omsattning_kkr ||
      row.revenue ||
      row.revenues ||
      "";
    const revenue = parseSwedishNumber(rawRevenue);
    // If column exists but is blank, skip (no revenue data = unknown)
    // If column doesn't exist in row at all, pass through
    const hasRevenueColumn =
      "omsattning" in row ||
      "omsättning" in row ||
      "omsattning_tkr" in row ||
      "omsattning_kkr" in row ||
      "revenue" in row ||
      "revenues" in row;
    if (
      hasRevenueColumn &&
      (revenue === null || revenue < config.min_revenue_kkr)
    ) {
      return {
        skip: true,
        reason: `revenue ${revenue ?? "unknown"} kkr < min ${config.min_revenue_kkr} kkr`,
      };
    }
  }

  // Employee count filters
  const rawEmployees =
    row.anstallda ||
    row.antal_anstallda ||
    row.employees ||
    row.antal_medarbetare ||
    "";
  const employees = parseSwedishNumber(rawEmployees);

  if (config.min_employees != null && employees !== null) {
    if (employees < config.min_employees) {
      return {
        skip: true,
        reason: `employees ${employees} < min ${config.min_employees}`,
      };
    }
  }

  if (config.max_employees != null && employees !== null) {
    if (employees > config.max_employees) {
      return {
        skip: true,
        reason: `employees ${employees} > max ${config.max_employees}`,
      };
    }
  }

  // Verksamhetsbeskrivning filters
  const verksamhet = (
    row.verksamhetsbeskrivning ||
    row.verksamhet ||
    row.description ||
    row.beskrivning ||
    row.bransch ||
    row.sni_beskrivning ||
    ""
  )
    .trim()
    .toLowerCase();

  // Include filter: ONLY import if verksamhet matches at least one keyword
  if (config.include_verksamhet_keywords?.length && verksamhet) {
    const matches = config.include_verksamhet_keywords.some((kw) =>
      verksamhet.includes(kw.toLowerCase()),
    );
    if (!matches) {
      return {
        skip: true,
        reason: `verksamhet "${verksamhet.slice(0, 60)}" matchar inga inkluderade nyckelord`,
      };
    }
  }

  // Exclude filter: skip if verksamhet matches any keyword
  if (config.exclude_verksamhet_keywords?.length && verksamhet) {
    const matched = config.exclude_verksamhet_keywords.find((kw) =>
      verksamhet.includes(kw.toLowerCase()),
    );
    if (matched) {
      return {
        skip: true,
        reason: `verksamhet keyword "${matched}"`,
      };
    }
  }

  return { skip: false };
}

// --- Pre-qualification: Quick website check before import ---

const PRE_QUAL_SKIP_DOMAINS = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "bokadirekt.se",
  "voady.com",
  "boka.se",
  "bokamera.se",
  "timecenter.se",
  "booksy.com",
  "fresha.com",
  "treatwell.se",
  "linktr.ee",
  "linktree.com",
  "hitta.se",
  "eniro.se",
  "allabolag.se",
  "ratsit.se",
  "google.com/maps",
  "maps.google",
  "yelp.com",
  "tripadvisor.com",
  "carrd.co",
  "beacons.ai",
];

interface PreQualResult {
  has_good_website: boolean;
  website: string | null;
  website_quality: "none" | "poor" | "ok" | "good";
  website_score: number;
}

async function quickWebsitePreCheck(
  companyName: string,
  city: string | null,
  serperApiKey: string,
): Promise<PreQualResult> {
  const noWebsite: PreQualResult = {
    has_good_website: false,
    website: null,
    website_quality: "none",
    website_score: 0,
  };

  const cleanName = companyName
    .replace(
      /\b(ab|hb|kb|ek\.?\s*för\.?|aktiebolag|handelsbolag|enskild firma|kommanditbolag|ekonomisk förening)\b/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .join(" ");

  const query =
    city && !cleanName.toLowerCase().includes(city.toLowerCase())
      ? `${cleanName} ${city}`
      : cleanName;

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": serperApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, gl: "se", hl: "sv", num: 5 }),
    });

    if (!res.ok) return noWebsite;
    const data = await res.json();

    let websiteUrl: string | null = data.knowledgeGraph?.website || null;

    if (!websiteUrl && data.organic) {
      const nameWords = cleanName
        .toLowerCase()
        .split(/\s+/)
        .filter((w: string) => w.length > 2);
      for (const item of data.organic) {
        const link = item.link.toLowerCase();
        if (PRE_QUAL_SKIP_DOMAINS.some((d) => link.includes(d))) continue;
        if (link.includes("/blogg/") || link.includes(".pdf")) continue;
        const hasMatch = nameWords.some(
          (w: string) =>
            item.title.toLowerCase().includes(w) || link.includes(w),
        );
        if (hasMatch) {
          websiteUrl = item.link;
          break;
        }
      }
    }

    if (
      !websiteUrl ||
      PRE_QUAL_SKIP_DOMAINS.some((d) => websiteUrl!.toLowerCase().includes(d))
    ) {
      return noWebsite;
    }

    // Quick HTTP check on the website
    // Scoring philosophy: start LOW (20). Only genuinely modern, well-built
    // sites can reach "good" (≥80). A basic WordPress or old HTML site should
    // NEVER be skipped — those are leads for a web agency.
    const url = websiteUrl.startsWith("http")
      ? websiteUrl
      : `https://${websiteUrl}`;
    try {
      const startTime = Date.now();
      const siteRes = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; CRMBot/1.0; +https://axonadigital.se)",
        },
      });
      const responseTime = Date.now() - startTime;

      if (!siteRes.ok) {
        return {
          has_good_website: false,
          website: websiteUrl,
          website_quality: "poor",
          website_score: 0,
        };
      }

      const html = await siteRes.text();
      const htmlLower = html.toLowerCase();

      // Parked / placeholder → immediate poor
      if (
        html.length < 2000 ||
        htmlLower.includes("domain is for sale") ||
        htmlLower.includes("coming soon") ||
        htmlLower.includes("under construction") ||
        htmlLower.includes("denna domän") ||
        htmlLower.includes("köp denna")
      ) {
        return {
          has_good_website: false,
          website: websiteUrl,
          website_quality: "poor",
          website_score: 5,
        };
      }

      // Start at 20 — "a site exists, nothing more"
      let score = 20;

      // --- Modern framework detection (only these can push to "good") ---
      // Full JS frameworks → genuinely custom/modern site
      if (htmlLower.includes("__next") || htmlLower.includes("_next/static")) {
        score += 40; // Next.js
      } else if (
        htmlLower.includes("__nuxt") ||
        htmlLower.includes("/_nuxt/")
      ) {
        score += 40; // Nuxt
      } else if (htmlLower.includes("___gatsby")) {
        score += 35; // Gatsby
      } else if (htmlLower.includes("_astro")) {
        score += 35; // Astro
      } else if (/ng-version=/i.test(html)) {
        score += 30; // Angular
      } else if (htmlLower.includes("webflow")) {
        score += 30; // Webflow
      } else if (htmlLower.includes("squarespace")) {
        score += 25; // Squarespace
      } else if (
        htmlLower.includes("shopify") ||
        htmlLower.includes("myshopify")
      ) {
        score += 25; // Shopify
      } else if (
        htmlLower.includes("wp-block-") &&
        (htmlLower.includes("wp-element") || htmlLower.includes("wp-json"))
      ) {
        // Modern WordPress with block editor (both markers needed)
        score += 15;
      }
      // NOTE: Wix, one.com, Loopia, Jimdo, Google Sites → no bonus
      // These are budget builders = leads for a web agency

      // --- Basic positive signals ---
      const finalUrl = siteRes.url || url;
      if (finalUrl.startsWith("https://")) score += 5;
      if (/meta[^>]+viewport/i.test(html)) score += 10;
      if (
        htmlLower.includes('loading="lazy"') ||
        htmlLower.includes("lazyload")
      )
        score += 5;
      if (
        htmlLower.includes("preconnect") ||
        htmlLower.includes("prefetch") ||
        htmlLower.includes("preload")
      )
        score += 5;
      if (responseTime < 1500) score += 5;
      // Structured data (schema.org, JSON-LD)
      if (
        htmlLower.includes("application/ld+json") ||
        htmlLower.includes("schema.org")
      )
        score += 5;

      // --- Negative signals (old/broken tech) ---
      if (!finalUrl.startsWith("https://")) score -= 5;
      if (!/meta[^>]+viewport/i.test(html)) score -= 10;
      if (htmlLower.includes("<font")) score -= 10;
      if (htmlLower.includes("shockwave-flash") || htmlLower.includes(".swf"))
        score -= 15;
      const jqMatch = html.match(/jquery[.-]?(\d+)\./i);
      if (jqMatch && parseInt(jqMatch[1]) < 3) score -= 5;
      // Table-based layout
      const tableCount = (htmlLower.match(/<table/g) || []).length;
      const divCount = (htmlLower.match(/<div/g) || []).length;
      if (tableCount > 3 && tableCount > divCount * 0.5) score -= 10;
      // Frames
      if (htmlLower.includes("<frameset")) score -= 10;
      // XHTML / no doctype
      if (htmlLower.includes("xhtml") || htmlLower.includes("transitional"))
        score -= 5;

      score = Math.max(0, Math.min(100, score));

      // Threshold 80: only truly modern, polished sites get skipped
      const quality: "good" | "ok" | "poor" =
        score >= 80 ? "good" : score >= 40 ? "ok" : "poor";

      return {
        has_good_website: quality === "good",
        website: websiteUrl,
        website_quality: quality,
        website_score: score,
      };
    } catch {
      return {
        has_good_website: false,
        website: websiteUrl,
        website_quality: "poor",
        website_score: 0,
      };
    }
  } catch {
    return noWebsite;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCronAuthorized(req: Request): boolean {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret =
    req.headers.get("x-cron-secret") ||
    new URL(req.url).searchParams.get("secret");

  return !!cronSecret && providedSecret === cronSecret;
}

function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function capitalizeCity(value: string | undefined) {
  if (!value) return null;
  return value
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function deriveStateAbbr(row: Record<string, string>) {
  const rawValue =
    row.state_abbr ||
    row.lan_kod ||
    row.lan ||
    row.lan_namn ||
    row.county ||
    row.region ||
    "";
  const cleaned = normalizeHeader(rawValue);

  if (!cleaned) return "Z";
  if (cleaned.length <= 3 && /^[a-z]+$/i.test(cleaned)) {
    return cleaned.toUpperCase();
  }

  return SWEDISH_COUNTY_CODES[cleaned] || "Z";
}

function normalizeServiceAccount(): ServiceAccountConfig | null {
  if (!GOOGLE_SERVICE_ACCOUNT_JSON) {
    return null;
  }

  let parsed: ServiceAccountConfig;
  try {
    parsed = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON) as ServiceAccountConfig;
  } catch {
    return null;
  }
  if (!parsed.client_email || !parsed.private_key || !parsed.token_uri) {
    return null;
  }

  return {
    ...parsed,
    private_key: parsed.private_key.replace(/\\n/g, "\n"),
  };
}

async function getGoogleAccessToken(serviceAccount: ServiceAccountConfig) {
  const now = Math.floor(Date.now() / 1000);
  const privateKey = await jose.importPKCS8(
    serviceAccount.private_key,
    "RS256",
  );
  const assertion = await new jose.SignJWT({
    scope: GOOGLE_SHEETS_SCOPE,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(serviceAccount.client_email)
    .setSubject(serviceAccount.client_email)
    .setAudience(serviceAccount.token_uri)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const tokenResponse = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!tokenResponse.ok) {
    const details = await tokenResponse.text();
    throw new Error(`Google token exchange failed: ${details}`);
  }

  const tokenJson = await tokenResponse.json();
  return tokenJson.access_token as string;
}

function escapeSheetName(sheetName: string) {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function toColumnLetter(index: number) {
  let current = index + 1;
  let letter = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    current = Math.floor((current - 1) / 26);
  }
  return letter;
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const nextChar = csv[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

function extractGoogleSheetId(sheetUrl: string) {
  try {
    const url = new URL(sheetUrl);
    const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function buildGoogleSheetCsvUrl(source: LeadImportSource) {
  const sheetId = extractGoogleSheetId(source.sheet_url);
  if (!sheetId) {
    return source.sheet_url;
  }
  const gid =
    source.sheet_gid ||
    (() => {
      try {
        return new URL(source.sheet_url).searchParams.get("gid") || "0";
      } catch {
        return "0";
      }
    })();
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function mapRowToCompany(
  row: Record<string, string>,
  sourceRowNumber: number,
  sourceId: number,
  runId: number,
): ParsedSheetRow | null {
  const orgNumber = (
    row.orgnr ||
    row.org_number ||
    row.organisationsnummer ||
    row.organizationsnummer ||
    ""
  )
    .replace(/\s+/g, "")
    .trim();
  const name = (row.namn || row.name || row.foretagsnamn || "").trim();

  if (!orgNumber || !name) {
    return null;
  }

  const address = (row.gatuadress || row.address || row.adress || "").trim();
  const zipcode = (row.postnummer || row.zipcode || row.postnr || "")
    .replace(/\s+/g, "")
    .trim();
  const city = capitalizeCity(row.ort || row.city || row.postort || row.kommun);
  const email = (row.email || row.epost || row.e_post || "")
    .trim()
    .toLowerCase();
  const description = (
    row.verksamhetsbeskrivning ||
    row.description ||
    row.beskrivning ||
    ""
  ).trim();

  return {
    sourceRowNumber,
    rowRecord: row,
    company: {
      name,
      org_number: orgNumber,
      address: address || null,
      zipcode: zipcode || null,
      city,
      state_abbr: deriveStateAbbr(row),
      country: "Sweden",
      description: description || null,
      source: "import",
      lead_status: "new",
      pipeline_state: "new",
      data_quality_status: "missing_contact",
      email: email || null,
      prospecting_status: "imported",
      source_row_number: sourceRowNumber,
      processing_order: sourceRowNumber,
      import_source_id: sourceId,
      import_run_id: runId,
      enrichment_data: {
        import_source: "google_sheet_csv",
        imported_at: new Date().toISOString(),
        source_row_number: sourceRowNumber,
        raw_import: {
          email: email || null,
          organisationsform:
            row.organisationsform || row.organisations_form || null,
          kommun: row.kommun || null,
          registreringsdatum: row.registreringsdatum || null,
          co_adress: row.co_adress || row.coaddress || null,
        },
      },
    },
  };
}

async function fetchSourceById(sourceId?: number) {
  let query = supabaseAdmin.from("lead_import_sources").select("*").limit(1);

  query = sourceId ? query.eq("id", sourceId) : query.eq("is_active", true);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as LeadImportSource | null;
}

async function claimSource(sourceId: number) {
  const staleBefore = new Date(
    Date.now() - RUNNING_STALE_MINUTES * 60_000,
  ).toISOString();

  const { data, error } = await supabaseAdmin.rpc("claim_lead_import_source", {
    p_source_id: sourceId,
    p_stale_before: staleBefore,
  });

  if (error) throw error;

  const claimed = Array.isArray(data) ? data[0] : null;
  return (claimed as LeadImportSource | null) ?? null;
}

async function updateSourceStatus(
  sourceId: number,
  update: Partial<LeadImportSource>,
) {
  const { error } = await supabaseAdmin
    .from("lead_import_sources")
    .update(update)
    .eq("id", sourceId);

  if (error) throw error;
}

async function createRun(
  source: LeadImportSource,
  triggeredBy: TriggeredBy,
  batchSize: number,
) {
  const { data, error } = await supabaseAdmin
    .from("lead_import_runs")
    .insert({
      source_id: source.id,
      triggered_by: triggeredBy,
      requested_batch_size: batchSize,
      actual_batch_size: 0,
      sheet_writeback_status: "not_attempted",
      sheet_rows_marked: 0,
      sheet_rows_failed: 0,
      status: "running",
    })
    .select("*")
    .single();

  if (error) throw error;
  return {
    ...(data as Omit<LeadImportRun, "imported_company_ids">),
    imported_company_ids: ((data?.imported_company_ids as number[]) || []).map(
      Number,
    ),
  } as LeadImportRun;
}

async function finalizeRun(
  source: LeadImportSource,
  runId: number,
  payload: {
    status: LeadImportRun["status"];
    rows_scanned: number;
    rows_inserted: number;
    rows_skipped_duplicates: number;
    rows_skipped_filtered: number;
    rows_failed: number;
    actual_batch_size: number;
    imported_company_ids: number[];
    sheet_writeback_status: WritebackStatus;
    sheet_rows_marked: number;
    sheet_rows_failed: number;
    sheet_writeback_error?: string | null;
    error_summary?: string | null;
    last_imported_row?: number;
    last_run_message?: string | null;
  },
) {
  const finishedAt = new Date().toISOString();
  const sourceUpdate: Record<string, unknown> = {
    last_run_status: payload.status,
    last_run_message:
      payload.last_run_message ??
      payload.error_summary ??
      `Scanned ${payload.rows_scanned}, inserted ${payload.rows_inserted}`,
  };

  if (payload.status === "success" || payload.status === "partial") {
    sourceUpdate.last_successful_run_at = finishedAt;
  }
  if (typeof payload.last_imported_row === "number") {
    sourceUpdate.last_imported_row = payload.last_imported_row;
  }

  const { error: runError } = await supabaseAdmin
    .from("lead_import_runs")
    .update({
      finished_at: finishedAt,
      status: payload.status,
      rows_scanned: payload.rows_scanned,
      rows_inserted: payload.rows_inserted,
      rows_skipped_duplicates: payload.rows_skipped_duplicates,
      rows_skipped_filtered: payload.rows_skipped_filtered,
      rows_failed: payload.rows_failed,
      actual_batch_size: payload.actual_batch_size,
      imported_company_ids: payload.imported_company_ids,
      sheet_writeback_status: payload.sheet_writeback_status,
      sheet_rows_marked: payload.sheet_rows_marked,
      sheet_rows_failed: payload.sheet_rows_failed,
      sheet_writeback_error: payload.sheet_writeback_error ?? null,
      error_summary: payload.error_summary ?? null,
    })
    .eq("id", runId);

  if (runError) throw runError;
  await updateSourceStatus(source.id, sourceUpdate);
}

function toRowRanges(rowNumbers: number[]) {
  if (rowNumbers.length === 0) return "inga";

  const sorted = [...rowNumbers].sort((a, b) => a - b);
  const ranges: string[] = [];
  let rangeStart = sorted[0];
  let previous = sorted[0];

  for (let index = 1; index < sorted.length; index++) {
    const current = sorted[index];
    if (current === previous || current === previous + 1) {
      previous = current;
      continue;
    }

    ranges.push(
      rangeStart === previous
        ? String(rangeStart)
        : `${rangeStart}-${previous}`,
    );
    rangeStart = current;
    previous = current;
  }

  ranges.push(
    rangeStart === previous ? String(rangeStart) : `${rangeStart}-${previous}`,
  );

  return ranges.join(", ");
}

function buildRowStats(
  pendingRows: Array<{ sourceRowNumber: number }>,
  processedRows: ProcessedRowResult[],
): RowStats {
  return {
    scanned: pendingRows.map((row) => row.sourceRowNumber),
    imported: processedRows
      .filter((row) => row.status === "imported")
      .map((row) => row.sourceRowNumber),
    duplicates: processedRows
      .filter((row) => row.status === "duplicate")
      .map((row) => row.sourceRowNumber),
    failed: processedRows
      .filter((row) => row.status === "failed")
      .map((row) => row.sourceRowNumber),
    prequalified: processedRows
      .filter((row) => row.status === "prequalified")
      .map((row) => row.sourceRowNumber),
  };
}

function buildLastRunMessage(rowStats: RowStats) {
  const parts = [
    `Rader: ${toRowRanges(rowStats.scanned)}`,
    `Nya: ${toRowRanges(rowStats.imported)}`,
  ];
  if (rowStats.prequalified.length > 0) {
    parts.push(`Bra hemsida (skippad): ${toRowRanges(rowStats.prequalified)}`);
  }
  parts.push(
    `Dubbletter: ${toRowRanges(rowStats.duplicates)}`,
    `Fel: ${toRowRanges(rowStats.failed)}`,
  );
  return parts.join(" | ");
}

async function fetchParsedRows(source: LeadImportSource) {
  const csvUrl = buildGoogleSheetCsvUrl(source);
  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch Google Sheet CSV (${response.status})`);
  }

  const csv = await response.text();
  const rows = parseCsv(csv);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((values, index) => {
    const rowRecord: Record<string, string> = {};
    headers.forEach((header, valueIndex) => {
      rowRecord[header] = (values[valueIndex] ?? "").trim();
    });

    return {
      sourceRowNumber: index + 2,
      rowRecord,
    };
  });
}

async function fetchGoogleSheetMetadata(
  source: LeadImportSource,
  accessToken: string,
) {
  const sheetId = extractGoogleSheetId(source.sheet_url);
  if (!sheetId) {
    throw new Error("Could not determine Google Sheet ID from sheet_url");
  }

  const metadataResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets(properties(sheetId,title))`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!metadataResponse.ok) {
    const details = await metadataResponse.text();
    throw new Error(`Failed to fetch Google Sheet metadata: ${details}`);
  }

  const metadata = await metadataResponse.json();
  const numericGid = Number(source.sheet_gid ?? 0);
  const matchingSheet = Array.isArray(metadata?.sheets)
    ? metadata.sheets.find((sheet: { properties?: { sheetId?: number } }) =>
        source.sheet_gid ? sheet?.properties?.sheetId === numericGid : true,
      )
    : null;

  const sheetTitle = matchingSheet?.properties?.title as string | undefined;
  if (!sheetTitle) {
    throw new Error("Could not resolve Google Sheet tab title for write-back");
  }

  return {
    spreadsheetId: sheetId,
    sheetTitle,
  };
}

async function ensureSheetStatusColumns(
  spreadsheetId: string,
  sheetTitle: string,
  accessToken: string,
) {
  const encodedRange = encodeURIComponent(`${escapeSheetName(sheetTitle)}!1:1`);
  const headerResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!headerResponse.ok) {
    const details = await headerResponse.text();
    throw new Error(`Failed to read Google Sheet headers: ${details}`);
  }

  const headerPayload = await headerResponse.json();
  const headers = Array.isArray(headerPayload?.values?.[0])
    ? (headerPayload.values[0] as string[])
    : [];
  const nextHeaders = [...headers];

  for (const columnName of SHEET_STATUS_COLUMNS) {
    if (!nextHeaders.includes(columnName)) {
      nextHeaders.push(columnName);
    }
  }

  if (nextHeaders.length !== headers.length) {
    const headerRange = encodeURIComponent(
      `${escapeSheetName(sheetTitle)}!A1:${toColumnLetter(nextHeaders.length - 1)}1`,
    );
    const updateResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${headerRange}?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          range: `${escapeSheetName(sheetTitle)}!A1:${toColumnLetter(nextHeaders.length - 1)}1`,
          majorDimension: "ROWS",
          values: [nextHeaders],
        }),
      },
    );

    if (!updateResponse.ok) {
      const details = await updateResponse.text();
      throw new Error(
        `Failed to ensure CRM status columns in Google Sheet: ${details}`,
      );
    }
  }

  return {
    headers: nextHeaders,
    statusColumnStartIndex: nextHeaders.indexOf(SHEET_STATUS_COLUMNS[0]),
  };
}

async function writeRowsBackToGoogleSheet(
  source: LeadImportSource,
  runId: number,
  rows: ProcessedRowResult[],
): Promise<SheetWritebackResult> {
  if (rows.length === 0) {
    return {
      status: "not_attempted",
      rows_marked: 0,
      rows_failed: 0,
      error: null,
    };
  }

  const serviceAccount = normalizeServiceAccount();
  if (!serviceAccount) {
    return {
      status: "not_attempted",
      rows_marked: 0,
      rows_failed: 0,
      error: null,
    };
  }

  try {
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const { spreadsheetId, sheetTitle } = await fetchGoogleSheetMetadata(
      source,
      accessToken,
    );
    const { statusColumnStartIndex } = await ensureSheetStatusColumns(
      spreadsheetId,
      sheetTitle,
      accessToken,
    );

    const valueRanges = rows.map((row) => {
      const startColumn = toColumnLetter(statusColumnStartIndex);
      const endColumn = toColumnLetter(
        statusColumnStartIndex + SHEET_STATUS_COLUMNS.length - 1,
      );
      return {
        range: `${escapeSheetName(sheetTitle)}!${startColumn}${row.sourceRowNumber}:${endColumn}${row.sourceRowNumber}`,
        majorDimension: "ROWS",
        values: [
          [
            row.status,
            row.importedAt ?? "",
            String(runId),
            row.companyId != null ? String(row.companyId) : "",
          ],
        ],
      };
    });

    const writebackResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          valueInputOption: "RAW",
          data: valueRanges,
        }),
      },
    );

    if (!writebackResponse.ok) {
      const details = await writebackResponse.text();
      throw new Error(
        `Failed to write CRM import status to Google Sheet: ${details}`,
      );
    }

    const payload = await writebackResponse.json();
    const updatedRows = Number(payload?.totalUpdatedRows ?? 0);

    if (updatedRows >= rows.length) {
      return {
        status: "success",
        rows_marked: rows.length,
        rows_failed: 0,
        error: null,
      };
    }

    return {
      status: "partial",
      rows_marked: updatedRows,
      rows_failed: Math.max(rows.length - updatedRows, 0),
      error: `Only ${updatedRows} of ${rows.length} rows were updated in Google Sheet`,
    };
  } catch (error) {
    return {
      status: "failed",
      rows_marked: 0,
      rows_failed: rows.length,
      error:
        error instanceof Error
          ? error.message
          : "Unknown Google Sheet write-back error",
    };
  }
}

async function enrichImportedCompanies(companyIds: number[], req: Request) {
  const functionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/enrich_company`;
  const results: Array<{
    company_id: number;
    success: boolean;
    error?: string;
  }> = [];

  for (const companyId of companyIds) {
    const { error: markError } = await supabaseAdmin
      .from("companies")
      .update({ prospecting_status: "enriching" })
      .eq("id", companyId);
    if (markError) {
      results.push({
        company_id: companyId,
        success: false,
        error: markError.message,
      });
      continue;
    }

    const headers = new Headers({ "Content-Type": "application/json" });
    if (isCronAuthorized(req)) {
      const cronSecret = Deno.env.get("CRON_SECRET");
      if (cronSecret) headers.set("x-cron-secret", cronSecret);
    } else {
      const authHeader = req.headers.get("authorization");
      if (authHeader) headers.set("authorization", authHeader);
    }

    try {
      const response = await fetch(functionUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ company_id: companyId }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          typeof result?.message === "string"
            ? result.message
            : `Enrichment failed (${response.status})`;
        await supabaseAdmin
          .from("companies")
          .update({ prospecting_status: "needs_review" })
          .eq("id", companyId);
        results.push({ company_id: companyId, success: false, error: message });
      } else {
        const { data: company } = await supabaseAdmin
          .from("companies")
          .select("phone_number")
          .eq("id", companyId)
          .single();
        const nextStatus = company?.phone_number
          ? "call_ready"
          : "needs_review";
        await supabaseAdmin
          .from("companies")
          .update({ prospecting_status: nextStatus })
          .eq("id", companyId);
        results.push({ company_id: companyId, success: true });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await supabaseAdmin
        .from("companies")
        .update({ prospecting_status: "needs_review" })
        .eq("id", companyId);
      results.push({ company_id: companyId, success: false, error: message });
    }

    await sleep(ENRICH_DELAY_MS);
  }

  return results;
}

async function handleRetryEnrichment(runId: number, req: Request) {
  const { data: run, error } = await supabaseAdmin
    .from("lead_import_runs")
    .select("id, imported_company_ids")
    .eq("id", runId)
    .single();
  if (error || !run) {
    return createErrorResponse(404, "Import run not found");
  }

  const companyIds = Array.isArray(run.imported_company_ids)
    ? run.imported_company_ids.map((value) => Number(value)).filter(Boolean)
    : [];

  const enrichmentResults = await enrichImportedCompanies(companyIds, req);
  const failed = enrichmentResults.filter((item) => !item.success);

  return createJsonResponse({
    run_id: runId,
    retried_companies: companyIds.length,
    enrichment_results: enrichmentResults,
    failed_count: failed.length,
  });
}

async function handleImportNext(
  source: LeadImportSource,
  batchSize: number,
  triggeredBy: TriggeredBy,
  req: Request,
  range?: {
    startRow: number;
    endRow: number;
  },
) {
  const claimedSource = await claimSource(source.id);
  if (!claimedSource) {
    return createErrorResponse(
      409,
      "An import is already running for the active lead source",
    );
  }

  const run = await createRun(claimedSource, triggeredBy, batchSize);

  try {
    const parsedRows = await fetchParsedRows(claimedSource);
    const pendingRows = range
      ? parsedRows.filter(
          (row) =>
            row.sourceRowNumber >= range.startRow &&
            row.sourceRowNumber <= range.endRow,
        )
      : parsedRows
          .filter(
            (row) => row.sourceRowNumber > claimedSource.last_imported_row,
          )
          .slice(0, batchSize);

    if (pendingRows.length === 0) {
      await finalizeRun(claimedSource, run.id, {
        status: "success",
        rows_scanned: 0,
        rows_inserted: 0,
        rows_skipped_duplicates: 0,
        rows_skipped_filtered: 0,
        rows_failed: 0,
        actual_batch_size: 0,
        imported_company_ids: [],
        sheet_writeback_status: "not_attempted",
        sheet_rows_marked: 0,
        sheet_rows_failed: 0,
        error_summary: "No rows left to import",
      });

      return createJsonResponse({
        source_id: claimedSource.id,
        run_id: run.id,
        rows_scanned: 0,
        rows_inserted: 0,
        rows_skipped_duplicates: 0,
        rows_skipped_filtered: 0,
        rows_failed: 0,
        actual_batch_size: 0,
        imported_company_ids: [],
        enrichment_results: [],
        ...(range
          ? {}
          : { last_imported_row: claimedSource.last_imported_row }),
        sheet_writeback_status: "not_attempted",
        sheet_rows_marked: 0,
        sheet_rows_failed: 0,
        message: "No rows left to import",
      });
    }

    const importedCompanyIds: number[] = [];
    const processedRows: ProcessedRowResult[] = [];
    const errors: string[] = [];
    let rowsInserted = 0;
    let rowsSkippedDuplicates = 0;
    let rowsSkippedFiltered = 0;
    let rowsSkippedPrequalified = 0;
    let rowsFailed = 0;
    let lastProcessedRow = claimedSource.last_imported_row;
    const filterConfig: ImportFilterConfig = claimedSource.filter_config ?? {};
    const serperApiKey = filterConfig.pre_qualify_website
      ? Deno.env.get("SERPER_API_KEY")
      : null;

    for (const pendingRow of pendingRows) {
      lastProcessedRow = pendingRow.sourceRowNumber;
      const mapped = mapRowToCompany(
        pendingRow.rowRecord,
        pendingRow.sourceRowNumber,
        claimedSource.id,
        run.id,
      );

      if (!mapped) {
        rowsFailed++;
        errors.push(
          `Row ${pendingRow.sourceRowNumber}: missing company name or org number`,
        );
        processedRows.push({
          sourceRowNumber: pendingRow.sourceRowNumber,
          status: "failed",
          companyId: null,
          importedAt: null,
        });
        continue;
      }

      const filterResult = applyImportFilters(
        pendingRow.rowRecord,
        filterConfig,
      );
      if (filterResult.skip) {
        rowsSkippedFiltered++;
        processedRows.push({
          sourceRowNumber: pendingRow.sourceRowNumber,
          status: "filtered",
          companyId: null,
          importedAt: null,
        });
        continue;
      }

      const { data: existing, error: existingError } = await supabaseAdmin
        .from("companies")
        .select("id")
        .eq("org_number", mapped.company.org_number)
        .maybeSingle();

      if (existingError) {
        rowsFailed++;
        errors.push(
          `Row ${pendingRow.sourceRowNumber}: ${existingError.message}`,
        );
        processedRows.push({
          sourceRowNumber: pendingRow.sourceRowNumber,
          status: "failed",
          companyId: null,
          importedAt: null,
        });
        continue;
      }

      if (existing) {
        rowsSkippedDuplicates++;
        processedRows.push({
          sourceRowNumber: pendingRow.sourceRowNumber,
          status: "duplicate",
          companyId: Number(existing.id),
          importedAt: new Date().toISOString(),
        });
        continue;
      }

      // Pre-qualification: quick website check before import
      let preQualData: PreQualResult | null = null;
      if (serperApiKey) {
        preQualData = await quickWebsitePreCheck(
          mapped.company.name,
          mapped.company.city,
          serperApiKey,
        );

        if (preQualData.has_good_website) {
          rowsSkippedPrequalified++;
          processedRows.push({
            sourceRowNumber: pendingRow.sourceRowNumber,
            status: "prequalified",
            companyId: null,
            importedAt: null,
          });
          await sleep(300);
          continue;
        }

        await sleep(300);
      }

      // Build insert payload with pre-qualification data if available
      const insertPayload = {
        ...mapped.company,
        ...(preQualData?.website
          ? {
              website: preQualData.website,
              website_quality: preQualData.website_quality,
              website_score: preQualData.website_score,
              has_website: preQualData.website_quality !== "none",
            }
          : {}),
        enrichment_data: {
          ...mapped.company.enrichment_data,
          ...(preQualData
            ? {
                pre_qualification: {
                  website: preQualData.website,
                  website_quality: preQualData.website_quality,
                  website_score: preQualData.website_score,
                  checked_at: new Date().toISOString(),
                },
              }
            : {}),
        },
      };

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("companies")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertError || !inserted) {
        rowsFailed++;
        errors.push(
          `Row ${pendingRow.sourceRowNumber}: ${insertError?.message || "insert failed"}`,
        );
        processedRows.push({
          sourceRowNumber: pendingRow.sourceRowNumber,
          status: "failed",
          companyId: null,
          importedAt: null,
        });
        continue;
      }

      rowsInserted++;
      const insertedId = Number(inserted.id);
      importedCompanyIds.push(insertedId);
      processedRows.push({
        sourceRowNumber: pendingRow.sourceRowNumber,
        status: "imported",
        companyId: insertedId,
        importedAt: new Date().toISOString(),
      });
    }

    const writebackResult = await writeRowsBackToGoogleSheet(
      claimedSource,
      run.id,
      processedRows,
    );
    const rowStats = buildRowStats(pendingRows, processedRows);
    const lastRunMessage = buildLastRunMessage(rowStats);

    const enrichmentResults = await enrichImportedCompanies(
      importedCompanyIds,
      req,
    );
    const enrichmentFailures = enrichmentResults.filter(
      (item) => !item.success,
    );

    const status: LeadImportRun["status"] =
      rowsFailed > 0 ||
      enrichmentFailures.length > 0 ||
      writebackResult.status === "failed" ||
      writebackResult.status === "partial"
        ? rowsInserted > 0
          ? "partial"
          : "failed"
        : "success";

    const errorSummary =
      errors.length > 0 || enrichmentFailures.length > 0
        ? [
            ...errors,
            ...(writebackResult.error ? [writebackResult.error] : []),
            ...enrichmentFailures.map(
              (failure) =>
                `Company ${failure.company_id}: ${failure.error || "enrichment failed"}`,
            ),
          ]
            .slice(0, 20)
            .join(" | ")
        : null;

    await finalizeRun(claimedSource, run.id, {
      status,
      rows_scanned: pendingRows.length,
      rows_inserted: rowsInserted,
      rows_skipped_duplicates: rowsSkippedDuplicates,
      rows_skipped_filtered: rowsSkippedFiltered + rowsSkippedPrequalified,
      rows_failed: rowsFailed,
      actual_batch_size: pendingRows.length,
      imported_company_ids: importedCompanyIds,
      sheet_writeback_status: writebackResult.status,
      sheet_rows_marked: writebackResult.rows_marked,
      sheet_rows_failed: writebackResult.rows_failed,
      sheet_writeback_error: writebackResult.error ?? null,
      error_summary: errorSummary,
      last_run_message: lastRunMessage,
      ...(range ? {} : { last_imported_row: lastProcessedRow }),
    });

    return createJsonResponse({
      source_id: claimedSource.id,
      run_id: run.id,
      rows_scanned: pendingRows.length,
      rows_inserted: rowsInserted,
      rows_skipped_duplicates: rowsSkippedDuplicates,
      rows_skipped_filtered: rowsSkippedFiltered,
      rows_skipped_prequalified: rowsSkippedPrequalified,
      rows_failed: rowsFailed,
      actual_batch_size: pendingRows.length,
      imported_company_ids: importedCompanyIds,
      enrichment_results: enrichmentResults,
      ...(range ? {} : { last_imported_row: lastProcessedRow }),
      sheet_writeback_status: writebackResult.status,
      sheet_rows_marked: writebackResult.rows_marked,
      sheet_rows_failed: writebackResult.rows_failed,
      sheet_writeback_error: writebackResult.error ?? null,
      status,
      row_stats: {
        scanned_rows: rowStats.scanned,
        imported_rows: rowStats.imported,
        duplicate_rows: rowStats.duplicates,
        prequalified_rows: rowStats.prequalified,
        failed_rows: rowStats.failed,
      },
      last_run_message: lastRunMessage,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown import error";

    await finalizeRun(claimedSource, run.id, {
      status: "failed",
      rows_scanned: 0,
      rows_inserted: 0,
      rows_skipped_duplicates: 0,
      rows_skipped_filtered: 0,
      rows_failed: 1,
      actual_batch_size: 0,
      imported_company_ids: [],
      sheet_writeback_status: "failed",
      sheet_rows_marked: 0,
      sheet_rows_failed: 0,
      sheet_writeback_error: errorMessage,
      error_summary: errorMessage,
    });

    throw error;
  }
}

async function handleRequest(req: Request, triggeredBy: TriggeredBy) {
  const body = (await parseOptionalJsonBody(req)) ?? {};
  const action =
    getEnumField(body, "action", [
      "import_next",
      "retry_enrichment",
    ] as const) || "import_next";

  if (action === "retry_enrichment") {
    const runId = getPositiveIntegerField(body, "run_id", {
      required: true,
    });
    return handleRetryEnrichment(runId as number, req);
  }

  const sourceId = getPositiveIntegerField(body, "source_id");
  const source = await fetchSourceById(sourceId);
  if (!source) {
    return createErrorResponse(404, "Active Google Sheet source not found");
  }

  const startRow = getPositiveIntegerField(body, "start_row");
  const endRow = getPositiveIntegerField(body, "end_row");

  if ((startRow == null) !== (endRow == null)) {
    return createErrorResponse(
      400,
      "start_row and end_row must be provided together",
    );
  }

  if (startRow != null && endRow != null) {
    if (startRow < 2 || endRow < 2) {
      return createErrorResponse(
        400,
        "start_row and end_row must be greater than or equal to 2",
      );
    }
    if (endRow < startRow) {
      return createErrorResponse(
        400,
        "end_row must be greater than or equal to start_row",
      );
    }

    const rangeBatchSize = endRow - startRow + 1;
    if (rangeBatchSize > MAX_BATCH_SIZE) {
      return createErrorResponse(
        400,
        `row range must contain less than or equal to ${MAX_BATCH_SIZE} rows`,
      );
    }

    return handleImportNext(source, rangeBatchSize, triggeredBy, req, {
      startRow,
      endRow,
    });
  }

  const batchSize =
    getPositiveIntegerField(body, "batch_size") || source.batch_size_default;
  if (batchSize > MAX_BATCH_SIZE) {
    return createErrorResponse(
      400,
      `batch_size must be less than or equal to ${MAX_BATCH_SIZE}`,
    );
  }

  return handleImportNext(source, batchSize, triggeredBy, req);
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method Not Allowed");
    }

    try {
      if (isCronAuthorized(req)) {
        return await handleRequest(req, "scheduled");
      }

      return await AuthMiddleware(req, async (req) =>
        UserMiddleware(req, async (req) => handleRequest(req, "manual")),
      );
    } catch (error) {
      console.error("import_google_sheet_leads error:", error);
      return errorResponseFromUnknown(error);
    }
  }),
);
