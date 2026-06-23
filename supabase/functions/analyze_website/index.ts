import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as jose from "jsr:@panva/jose@6";
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
import type {
  BusinessProfile,
  PageSpeedSummary,
  SearchConsoleSummary,
  SeoChecks,
} from "./findings.ts";
import { computeFindings } from "./findings.ts";
import { domainOf, isPlaceMatch } from "./matching.ts";
import {
  resolveVisibilityPeriod,
  type VisibilityPeriod,
  type VisibilityWindowKind,
} from "../_shared/visibilityPeriods.ts";
import { classifySearchOpportunities } from "./searchOpportunities.ts";

/**
 * Analyze Website — hemsidestatistik + brist-analys per företag (Fas 2 av
 * kundregistret, feedback #5).
 *
 * Lägen:
 *   { company_id }  — analysera ETT företag (knappen på Kund-fliken, user-JWT)
 *   { cron: true }  — analysera ALLA kunder med delivered_website_url
 *                     (pg_cron via x-cron-secret; körs i bakgrunden, svarar 202)
 *
 * Källor (varje källa är oberoende — ett källfel fäller aldrig analysen):
 *   a) PageSpeed Insights  (GOOGLE_PAGESPEED_API_KEY)
 *   b) Google Business     (GOOGLE_MAPS_API_KEY; place_id eller textsearch)
 *   c) Egen SEO/AI-crawl   (ingen nyckel: title/meta/og/schema/sitemap/llms.txt)
 *   d) Search Console      (GOOGLE_SERVICE_ACCOUNT_JSON; hybrid — endast för
 *                           properties där service-kontot lagts till som användare)
 *
 * Resultat sparas som rad i website_snapshots (tidsserie).
 */

const FETCH_TIMEOUT_MS = 15_000;
// Lighthouse-körningen för långsamma sajter ligger ofta 15–60s; 60s slog i
// taket för danielssonsbygg (64,5s total körning → null). 90s ger marginal
// utan att riskera edge-funktionens wall-clock-gräns (~150s).
const PAGESPEED_TIMEOUT_MS = 90_000;
const CRON_BATCH_SIZE = 3;

// --- Helpers ---

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// --- a) PageSpeed Insights ---

async function fetchPageSpeed(url: string): Promise<PageSpeedSummary | null> {
  // PageSpeed-API:t fungerar även utan nyckel (delad, låg kvot) — kör hellre
  // nyckellöst än att hoppa över källan. Med GOOGLE_PAGESPEED_API_KEY satt
  // får vi egen kvot (25k/dag).
  const apiKey = Deno.env.get("GOOGLE_PAGESPEED_API_KEY");
  if (!apiKey) {
    console.warn(
      "analyze_website: GOOGLE_PAGESPEED_API_KEY not set — running keyless with shared quota",
    );
  }

  const endpoint = new URL(
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
  );
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", "mobile");
  endpoint.searchParams.append("category", "PERFORMANCE");
  endpoint.searchParams.append("category", "SEO");
  if (apiKey) {
    endpoint.searchParams.set("key", apiKey);
  }

  // Google svarar ibland med transient 429/500 — ett snabbt omförsök räddar
  // de fallen. Timeout (AbortError) försöker vi INTE om: ett andra 90s-försök
  // riskerar funktionens wall-clock-gräns och Lighthouse-kön är sällan kortare.
  let response: Response | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await fetchWithTimeout(endpoint.toString(), PAGESPEED_TIMEOUT_MS);
    if (r.ok) {
      response = r;
      break;
    }
    const body = (await r.text()).slice(0, 200);
    console.error(
      `analyze_website: PageSpeed ${r.status} (försök ${attempt}/2) for ${url}: ${body}`,
    );
    if (attempt === 2 || (r.status !== 429 && r.status < 500)) {
      throw new Error(`PageSpeed API ${r.status}: ${body}`);
    }
  }
  if (!response) throw new Error("PageSpeed API returned no response");

  const result = await response.json();
  const lighthouse = result?.lighthouseResult;
  if (!lighthouse) return null;

  const toScore = (value: unknown): number | null =>
    typeof value === "number" ? Math.round(value * 100) : null;

  const audits = lighthouse.audits ?? {};
  const numeric = (id: string): number | null => {
    const value = audits[id]?.numericValue;
    return typeof value === "number" ? value : null;
  };

  // Topp-3 förbättringsmöjligheter med mätbar besparing
  const opportunities = Object.entries(
    audits as Record<
      string,
      {
        title?: string;
        details?: { type?: string; overallSavingsMs?: number };
      }
    >,
  )
    .filter(
      ([, audit]) =>
        audit?.details?.type === "opportunity" &&
        (audit.details.overallSavingsMs ?? 0) > 100,
    )
    .sort(
      (a, b) =>
        (b[1].details?.overallSavingsMs ?? 0) -
        (a[1].details?.overallSavingsMs ?? 0),
    )
    .slice(0, 3)
    .map(([id, audit]) => ({
      id,
      title: audit.title ?? id,
      savings_ms: Math.round(audit.details?.overallSavingsMs ?? 0),
    }));

  const fieldSource = result?.loadingExperience?.metrics
    ? { scope: "url" as const, metrics: result.loadingExperience.metrics }
    : result?.originLoadingExperience?.metrics
      ? {
          scope: "origin" as const,
          metrics: result.originLoadingExperience.metrics,
        }
      : null;
  const fieldMetric = (key: string) => fieldSource?.metrics?.[key] ?? null;
  const fieldValue = (key: string): number | null => {
    const value = fieldMetric(key)?.percentile;
    return typeof value === "number" ? value : null;
  };
  const fieldRating = (key: string) => {
    const value = fieldMetric(key)?.category;
    return value === "FAST"
      ? ("GOOD" as const)
      : value === "AVERAGE"
        ? ("NEEDS_IMPROVEMENT" as const)
        : value === "SLOW"
          ? ("POOR" as const)
          : null;
  };

  return {
    performance_score: toScore(lighthouse.categories?.performance?.score),
    seo_score: toScore(lighthouse.categories?.seo?.score),
    lcp_ms: numeric("largest-contentful-paint"),
    cls: numeric("cumulative-layout-shift"),
    tbt_ms: numeric("total-blocking-time"),
    opportunities,
    field_data: fieldSource
      ? {
          scope: fieldSource.scope,
          lcp_ms: fieldValue("LARGEST_CONTENTFUL_PAINT_MS"),
          inp_ms: fieldValue("INTERACTION_TO_NEXT_PAINT"),
          cls:
            fieldValue("CUMULATIVE_LAYOUT_SHIFT_SCORE") == null
              ? null
              : fieldValue("CUMULATIVE_LAYOUT_SHIFT_SCORE")! / 100,
          lcp_rating: fieldRating("LARGEST_CONTENTFUL_PAINT_MS"),
          inp_rating: fieldRating("INTERACTION_TO_NEXT_PAINT"),
          cls_rating: fieldRating("CUMULATIVE_LAYOUT_SHIFT_SCORE"),
        }
      : null,
  };
}

// --- b) Google Business-profil ---

async function fetchPlaceDetails(
  placeId: string,
  apiKey: string,
): Promise<{
  name: string | null;
  website: string | null;
  rating: number | null;
  reviews_count: number | null;
} | null> {
  const endpoint = new URL(
    "https://maps.googleapis.com/maps/api/place/details/json",
  );
  endpoint.searchParams.set("place_id", placeId);
  endpoint.searchParams.set("fields", "name,website,rating,user_ratings_total");
  endpoint.searchParams.set("key", apiKey);

  const response = await fetchWithTimeout(
    endpoint.toString(),
    FETCH_TIMEOUT_MS,
  );
  const data = await response.json();
  if (data.status !== "OK") return null;
  return {
    name: data.result?.name ?? null,
    website: data.result?.website ?? null,
    rating: data.result?.rating ?? null,
    reviews_count: data.result?.user_ratings_total ?? null,
  };
}

async function fetchBusinessProfile(company: {
  google_place_id?: string | null;
  name: string;
  city?: string | null;
  website?: string | null;
}): Promise<BusinessProfile | null> {
  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
    console.warn(
      "analyze_website: GOOGLE_MAPS_API_KEY not set — skipping business profile",
    );
    return null;
  }

  // Sparat place_id är medvetet kopplat till företaget (t.ex. via
  // GoogleMapsScraper-importen) — litar på det utan namnverifiering.
  if (company.google_place_id) {
    const details = await fetchPlaceDetails(company.google_place_id, apiKey);
    if (details) {
      return {
        found: true,
        rating: details.rating,
        reviews_count: details.reviews_count,
        place_id: company.google_place_id,
      };
    }
    // NOT_FOUND på sparat place_id → falla igenom till textsearch
  }

  const endpoint = new URL(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
  );
  endpoint.searchParams.set(
    "query",
    [company.name, company.city].filter(Boolean).join(" "),
  );
  endpoint.searchParams.set("key", apiKey);

  const response = await fetchWithTimeout(
    endpoint.toString(),
    FETCH_TIMEOUT_MS,
  );
  const data = await response.json();

  if (data.status === "ZERO_RESULTS") {
    return { found: false };
  }
  if (data.status !== "OK") {
    throw new Error(`Places API status ${data.status}`);
  }

  // Textsearch returnerar ofta NÅGON verksamhet på orten — verifiera att
  // kandidaten verkligen är kundens företag (namn-token eller domänmatch)
  // innan vi rapporterar betyg/recensioner som kundens.
  const candidates = (data.results ?? []).slice(0, 3) as Array<{
    place_id?: string;
    name?: string;
    rating?: number;
    user_ratings_total?: number;
  }>;

  for (const candidate of candidates) {
    if (
      !isPlaceMatch({
        companyName: company.name,
        companyWebsite: company.website,
        placeName: candidate.name,
        placeWebsite: null,
      })
    ) {
      continue;
    }

    // Namnet matchar — hämta details för domän-dubbelkoll när båda har webb.
    const details = candidate.place_id
      ? await fetchPlaceDetails(candidate.place_id, apiKey)
      : null;
    const companyDomain = domainOf(company.website);
    const placeDomain = domainOf(details?.website);
    if (companyDomain && placeDomain && companyDomain !== placeDomain) {
      continue; // Namnlik verksamhet med ANNAN hemsida — inte kundens profil.
    }

    return {
      found: true,
      rating: details?.rating ?? candidate.rating ?? null,
      reviews_count:
        details?.reviews_count ?? candidate.user_ratings_total ?? null,
      place_id: candidate.place_id ?? null,
    };
  }

  // Träffar fanns men ingen kunde verifieras som kundens verksamhet.
  return { found: false };
}

// --- c) Egen SEO/AI-sök-crawl ---

async function probeExists(url: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS, {
      redirect: "follow",
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function crawlSeoChecks(url: string): Promise<SeoChecks | null> {
  let html: string;
  let xRobotsTag = "";
  try {
    const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS, {
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`Website returned HTTP ${response.status}`);
    }
    xRobotsTag = response.headers.get("x-robots-tag") ?? "";
    html = await response.text();
  } catch (error) {
    throw new Error(
      `Could not fetch website: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const origin = new URL(url).origin;
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const metaDescMatch =
    html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    ) ??
    html.match(
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
    );
  const metaRobots =
    html.match(
      /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i,
    )?.[1] ??
    html.match(
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']robots["']/i,
    )?.[1] ??
    "";

  // robots.txt kan peka ut sitemap som ligger på annan path
  let robotsBody = "";
  try {
    const robotsResponse = await fetchWithTimeout(
      `${origin}/robots.txt`,
      FETCH_TIMEOUT_MS,
    );
    if (robotsResponse.ok) robotsBody = await robotsResponse.text();
  } catch {
    // robots saknas — hanteras nedan
  }

  const [sitemapExists, llmsExists] = await Promise.all([
    /sitemap:/i.test(robotsBody)
      ? Promise.resolve(true)
      : probeExists(`${origin}/sitemap.xml`),
    probeExists(`${origin}/llms.txt`),
  ]);

  return {
    title: titleMatch?.[1]?.trim() || null,
    meta_description: metaDescMatch?.[1]?.trim() || null,
    og_tags: /<meta[^>]+property=["']og:/i.test(html),
    schema_org: /application\/ld\+json/i.test(html),
    sitemap: sitemapExists,
    robots: robotsBody.length > 0,
    llms_txt: llmsExists,
    h1: /<h1[\s>]/i.test(html),
    indexable: !/noindex/i.test(`${metaRobots} ${xRobotsTag}`),
  };
}

// --- d) Google Search Console (OAuth-användartoken eller service-konto) ---

type ServiceAccountConfig = {
  client_email: string;
  private_key: string;
  token_uri: string;
};

type AuthorizedUserConfig = {
  type: "authorized_user";
  client_id: string;
  client_secret: string;
  refresh_token: string;
  // Krävs när credentialen kommer från gclouds delade OAuth-klient:
  // API-anrop måste attribueras till ett eget projekt via x-goog-user-project.
  quota_project_id?: string;
};

// Sätts av getGoogleAccessToken när credentialen har quota_project_id.
let googleQuotaProject: string | null = null;

function googleApiHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    ...(googleQuotaProject
      ? { "x-goog-user-project": googleQuotaProject }
      : {}),
  };
}

/**
 * Byter en authorized_user-credential (gcloud application-default login,
 * scopad till webmasters.readonly) mot en access token. Föredragen väg:
 * info@axonadigital.se ser ALLA Axonas Search Console-properties utan
 * per-sajt-konfiguration, och org-policyn som blockerar service-kontonycklar
 * kringgås inte.
 */
async function getAccessTokenFromAuthorizedUser(
  config: AuthorizedUserConfig,
): Promise<string | null> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.client_id,
      client_secret: config.client_secret,
      refresh_token: config.refresh_token,
    }),
  });
  if (!tokenResponse.ok) {
    console.error(
      `analyze_website: OAuth refresh failed: ${(await tokenResponse.text()).slice(0, 200)}`,
    );
    return null;
  }
  return (await tokenResponse.json()).access_token as string;
}

async function getGoogleAccessToken(scope: string): Promise<string | null> {
  // Dedikerad secret för GSC-läsaren. GOOGLE_SERVICE_ACCOUNT_JSON delas av
  // calendar_sync + import_google_sheet_leads — att återanvända den skulle
  // aktivera deras Google-vägar med ett konto som saknar deras behörigheter.
  const raw =
    Deno.env.get("GSC_GOOGLE_CREDENTIALS") ??
    Deno.env.get("GSC_SERVICE_ACCOUNT_JSON") ??
    Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (parsed.type === "authorized_user") {
    const config = parsed as unknown as AuthorizedUserConfig;
    if (!config.client_id || !config.client_secret || !config.refresh_token) {
      return null;
    }
    googleQuotaProject = config.quota_project_id ?? null;
    return getAccessTokenFromAuthorizedUser(config);
  }

  const serviceAccount = parsed as unknown as ServiceAccountConfig;
  if (
    !serviceAccount.client_email ||
    !serviceAccount.private_key ||
    !serviceAccount.token_uri
  ) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const privateKey = await jose.importPKCS8(
    serviceAccount.private_key.replace(/\\n/g, "\n"),
    "RS256",
  );
  const assertion = await new jose.SignJWT({ scope })
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
    console.error(
      `analyze_website: Google token exchange failed: ${(await tokenResponse.text()).slice(0, 200)}`,
    );
    return null;
  }
  return (await tokenResponse.json()).access_token as string;
}

async function fetchSearchConsole(
  url: string,
  period: VisibilityPeriod,
): Promise<SearchConsoleSummary | null> {
  const token = await getGoogleAccessToken(
    "https://www.googleapis.com/auth/webmasters.readonly",
  );
  if (!token) return null;

  const hostname = hostnameOf(url);
  if (!hostname) return null;

  // Lista properties kontot har åtkomst till och matcha mot domänen.
  const sitesResponse = await fetchWithTimeout(
    "https://www.googleapis.com/webmasters/v3/sites",
    FETCH_TIMEOUT_MS,
    { headers: googleApiHeaders(token) },
  );
  if (!sitesResponse.ok) {
    // Tidigare tyst null → omöjligt att skilja "saknar åtkomst" från "anropet
    // failade". Logga status + body så roten syns i edge-loggen.
    throw new Error(
      `GSC sites.list ${sitesResponse.status}: ${(await sitesResponse.text()).slice(0, 300)}`,
    );
  }

  const sites = (await sitesResponse.json()) as {
    siteEntry?: Array<{ siteUrl: string; permissionLevel: string }>;
  };
  const entries = sites.siteEntry ?? [];
  const property = entries.find((entry) => {
    if (entry.permissionLevel === "siteUnverifiedUser") return false;
    const siteUrl = entry.siteUrl;
    if (siteUrl.startsWith("sc-domain:")) {
      const domain = siteUrl.slice("sc-domain:".length);
      return hostname === domain || hostname.endsWith(`.${domain}`);
    }
    return hostnameOf(siteUrl) === hostname;
  });
  if (!property) {
    // Ingen matchande property — logga vad kontot FAKTISKT ser så vi kan se om
    // det är fel konto (propertyn saknas) eller ett matchningsfel (finns men
    // matchar inte hostname).
    console.warn(
      `analyze_website: GSC no property for hostname "${hostname}" — ${entries.length} sites visible: ${entries
        .map((e) => `${e.siteUrl}(${e.permissionLevel})`)
        .join(", ")
        .slice(0, 500)}`,
    );
    return null; // Ingen åtkomst till denna kunds property — inte ett fel.
  }

  const queryUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property.siteUrl)}/searchAnalytics/query`;

  const analyticsQuery = (body: Record<string, unknown>) =>
    fetchWithTimeout(queryUrl, FETCH_TIMEOUT_MS, {
      method: "POST",
      headers: {
        ...googleApiHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: period.startDate,
        endDate: period.endDate,
        dataState: "final",
        ...body,
      }),
    });

  const [totalsResponse, queriesResponse, pagesResponse] = await Promise.all([
    analyticsQuery({}),
    analyticsQuery({ dimensions: ["query"], rowLimit: 250 }),
    analyticsQuery({ dimensions: ["page"], rowLimit: 10 }),
  ]);
  if (!totalsResponse.ok) {
    throw new Error(
      `GSC totals ${totalsResponse.status}: ${(await totalsResponse.text()).slice(0, 200)}`,
    );
  }

  const totals = (await totalsResponse.json()).rows?.[0];
  const queryRows = queriesResponse.ok
    ? ((await queriesResponse.json()).rows ?? [])
    : [];
  const pageRows = pagesResponse.ok
    ? ((await pagesResponse.json()).rows ?? [])
    : [];
  type AnalyticsRow = {
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  const normalizedQueries = (queryRows as AnalyticsRow[]).map((row) => ({
    query: row.keys?.[0] ?? "",
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: Math.round(row.position * 10) / 10,
  }));
  const opportunities = classifySearchOpportunities(normalizedQueries);

  return {
    clicks: totals?.clicks ?? 0,
    impressions: totals?.impressions ?? 0,
    ctr: totals?.ctr ?? 0,
    position: totals?.position ?? 0,
    period_start: period.startDate,
    period_end: period.endDate,
    data_state: "final",
    top_queries: normalizedQueries.slice(0, 10),
    top_pages: (pageRows as AnalyticsRow[]).map((row) => ({
      page: row.keys?.[0] ?? "",
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: Math.round(row.position * 10) / 10,
    })),
    opportunities,
  };
}

// --- Analys av ett företag ---

type SourceState = {
  status: "available" | "unavailable" | "error";
  message?: string;
};

async function inspectSource<T>(
  label: string,
  promise: Promise<T>,
): Promise<{ value: T | null; state: SourceState }> {
  try {
    const value = await promise;
    return {
      value: value ?? null,
      state:
        value == null ? { status: "unavailable" } : { status: "available" },
    };
  } catch (error) {
    console.error(`analyze_website: ${label} failed:`, error);
    return {
      value: null,
      state: {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

async function analyzeCompany(
  companyId: number,
  source: "manual" | "cron",
  period: VisibilityPeriod,
): Promise<{ snapshot_id: number; findings_count: number }> {
  const { data: company, error: companyError } = await supabaseAdmin
    .from("companies")
    .select("id, name, city, website, google_place_id")
    .eq("id", companyId)
    .single();
  if (companyError || !company) {
    throw new Error(`Company ${companyId} not found`);
  }

  const { data: details } = await supabaseAdmin
    .from("customer_details")
    .select("delivered_website_url")
    .eq("company_id", companyId)
    .maybeSingle();

  const rawUrl = details?.delivered_website_url || company.website;
  if (!rawUrl) {
    throw new Error(
      `Company ${companyId} has no website to analyze (customer_details.delivered_website_url and companies.website are both empty)`,
    );
  }
  const url = normalizeUrl(rawUrl);

  const [pageSpeedResult, seoResult, businessResult, searchResult] =
    await Promise.all([
      inspectSource("pagespeed", fetchPageSpeed(url)),
      inspectSource("seo_crawl", crawlSeoChecks(url)),
      inspectSource("business_profile", fetchBusinessProfile(company)),
      inspectSource("search_console", fetchSearchConsole(url, period)),
    ]);
  const pagespeed = pageSpeedResult.value;
  const seoChecks = seoResult.value;
  const businessProfile = businessResult.value;
  const searchConsole = searchResult.value;

  const findings = computeFindings({
    pagespeed,
    seoChecks,
    businessProfile,
    searchConsole,
  });
  const fieldData = pagespeed?.field_data ?? null;
  const labPageSpeed = pagespeed
    ? {
        performance_score: pagespeed.performance_score,
        seo_score: pagespeed.seo_score,
        lcp_ms: pagespeed.lcp_ms,
        cls: pagespeed.cls,
        tbt_ms: pagespeed.tbt_ms,
        opportunities: pagespeed.opportunities,
      }
    : null;
  const sourceStatus = {
    pagespeed: pageSpeedResult.state,
    seo_crawl: seoResult.state,
    business_profile: businessResult.state,
    search_console: searchResult.state,
  };
  const availableSources = Object.values(sourceStatus).filter(
    (state) => state.status === "available",
  ).length;
  const snapshotValues = {
    company_id: companyId,
    source,
    url,
    period_start: period.startDate,
    period_end: period.endDate,
    window_kind: period.kind,
    data_coverage: {
      available_sources: availableSources,
      total_sources: 4,
      ratio: availableSources / 4,
      has_search_console: searchResult.state.status === "available",
      has_field_data: fieldData != null,
    },
    source_status: sourceStatus,
    performance_score: pagespeed?.performance_score ?? null,
    seo_score: pagespeed?.seo_score ?? null,
    pagespeed: labPageSpeed,
    field_data: fieldData,
    seo_checks: seoChecks,
    business_profile: businessProfile,
    search_console: searchConsole,
    findings,
  };

  let snapshot;
  let insertError;
  if (period.kind === "calendar_month") {
    const { data: existing } = await supabaseAdmin
      .from("website_snapshots")
      .select("id")
      .eq("company_id", companyId)
      .eq("window_kind", "calendar_month")
      .eq("period_start", period.startDate)
      .maybeSingle();
    const result = existing
      ? await supabaseAdmin
          .from("website_snapshots")
          .update({ ...snapshotValues, fetched_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select("id")
          .single()
      : await supabaseAdmin
          .from("website_snapshots")
          .insert(snapshotValues)
          .select("id")
          .single();
    snapshot = result.data;
    insertError = result.error;
  } else {
    const result = await supabaseAdmin
      .from("website_snapshots")
      .insert(snapshotValues)
      .select("id")
      .single();
    snapshot = result.data;
    insertError = result.error;
  }
  if (insertError || !snapshot) {
    throw new Error(`Failed to store snapshot: ${insertError?.message}`);
  }

  return { snapshot_id: snapshot.id, findings_count: findings.length };
}

// --- Cron-läge: alla kunder med levererad hemsida, i batchar ---

async function runCronSweep(period: VisibilityPeriod): Promise<void> {
  const { data: customers, error } = await supabaseAdmin
    .from("customer_details")
    .select("company_id")
    .not("delivered_website_url", "is", null);
  if (error || !customers) {
    console.error("analyze_website cron: could not list customers", error);
    return;
  }

  console.warn(`analyze_website cron: analyzing ${customers.length} customers`);
  for (let i = 0; i < customers.length; i += CRON_BATCH_SIZE) {
    const batch = customers.slice(i, i + CRON_BATCH_SIZE);
    await Promise.all(
      batch.map((row) =>
        analyzeCompany(row.company_id, "cron", period).catch((err) =>
          console.error(
            `analyze_website cron: company ${row.company_id} failed:`,
            err,
          ),
        ),
      ),
    );
  }
  console.warn("analyze_website cron: sweep complete");
}

// --- Main handler (samma dubbla auth-läge som enrich_company) ---

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
          const period = resolveVisibilityPeriod({ kind: "calendar_month" });
          // Kör svepet i bakgrunden — pg_net väntar inte på långa analyser.
          const sweep = runCronSweep(period);
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
        const requestedKind = (body as { window_kind?: unknown }).window_kind;
        if (
          requestedKind != null &&
          requestedKind !== "rolling_28d" &&
          requestedKind !== "calendar_month"
        ) {
          throw new Error("window_kind must be rolling_28d or calendar_month");
        }
        const period = resolveVisibilityPeriod({
          kind: (requestedKind as VisibilityWindowKind | undefined) ?? null,
          startDate:
            typeof (body as { start_date?: unknown }).start_date === "string"
              ? (body as { start_date: string }).start_date
              : null,
          endDate:
            typeof (body as { end_date?: unknown }).end_date === "string"
              ? (body as { end_date: string }).end_date
              : null,
        });
        const result = await analyzeCompany(
          company_id as number,
          "manual",
          period,
        );
        return createJsonResponse({ success: true, period, ...result });
      } catch (error) {
        return errorResponseFromUnknown(error);
      }
    }),
  ),
);
