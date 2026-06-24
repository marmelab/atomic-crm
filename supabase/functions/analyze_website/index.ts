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
  CompetitorSnapshot,
  CoreWebVitalsFieldData,
  GbpActions,
  PageSpeedMetrics,
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
import { brandTokens, classifyBrandedQueries } from "./brandedQueries.ts";
import { findLocalPosition, type LocalRankResult } from "./localRank.ts";

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

// Plockar ut hela labb-uppsättningen (inte bara LCP/CLS/TBT) ur ett
// Lighthouse-svar — samma parsing oavsett mobil/desktop-strategi.
function parseLighthouseMetrics(lighthouse: {
  categories?: { performance?: { score?: unknown }; seo?: { score?: unknown } };
  audits?: Record<
    string,
    {
      numericValue?: number;
      title?: string;
      details?: { type?: string; overallSavingsMs?: number };
    }
  >;
}): PageSpeedMetrics {
  const toScore = (value: unknown): number | null =>
    typeof value === "number" ? Math.round(value * 100) : null;

  const audits = lighthouse.audits ?? {};
  const numeric = (id: string): number | null => {
    const value = audits[id]?.numericValue;
    return typeof value === "number" ? value : null;
  };

  // Topp-3 förbättringsmöjligheter med mätbar besparing
  const opportunities = Object.entries(audits)
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

  return {
    performance_score: toScore(lighthouse.categories?.performance?.score),
    seo_score: toScore(lighthouse.categories?.seo?.score),
    lcp_ms: numeric("largest-contentful-paint"),
    cls: numeric("cumulative-layout-shift"),
    tbt_ms: numeric("total-blocking-time"),
    fcp_ms: numeric("first-contentful-paint"),
    speed_index_ms: numeric("speed-index"),
    tti_ms: numeric("interactive"),
    opportunities,
  };
}

// Verklig användardata (CrUX). Sid-nivå (loadingExperience) föredras; faller
// tillbaka på origin-nivå när sidan själv saknar underlag. null = för låg
// trafik för fältdata överhuvudtaget.
function parseFieldData(result: {
  loadingExperience?: { metrics?: Record<string, unknown> };
  originLoadingExperience?: { metrics?: Record<string, unknown> };
}): CoreWebVitalsFieldData | null {
  const fieldSource = result?.loadingExperience?.metrics
    ? { scope: "url" as const, metrics: result.loadingExperience.metrics }
    : result?.originLoadingExperience?.metrics
      ? {
          scope: "origin" as const,
          metrics: result.originLoadingExperience.metrics,
        }
      : null;
  if (!fieldSource) return null;

  const metric = (key: string) =>
    (fieldSource.metrics?.[key] as
      | { percentile?: number; category?: string }
      | undefined) ?? null;
  const fieldValue = (key: string): number | null => {
    const value = metric(key)?.percentile;
    return typeof value === "number" ? value : null;
  };
  const fieldRating = (key: string) => {
    const value = metric(key)?.category;
    return value === "FAST"
      ? ("GOOD" as const)
      : value === "AVERAGE"
        ? ("NEEDS_IMPROVEMENT" as const)
        : value === "SLOW"
          ? ("POOR" as const)
          : null;
  };
  const cls = fieldValue("CUMULATIVE_LAYOUT_SHIFT_SCORE");
  return {
    scope: fieldSource.scope,
    lcp_ms: fieldValue("LARGEST_CONTENTFUL_PAINT_MS"),
    inp_ms: fieldValue("INTERACTION_TO_NEXT_PAINT"),
    cls: cls == null ? null : cls / 100,
    lcp_rating: fieldRating("LARGEST_CONTENTFUL_PAINT_MS"),
    inp_rating: fieldRating("INTERACTION_TO_NEXT_PAINT"),
    cls_rating: fieldRating("CUMULATIVE_LAYOUT_SHIFT_SCORE"),
  };
}

// En enskild PSI-körning för en strategi. Returnerar labb-metrik + (för mobil)
// fältdata. Kastar vid hårt API-fel så inspectSource kan flagga källan.
async function fetchPageSpeedRun(
  url: string,
  strategy: "mobile" | "desktop",
): Promise<{
  metrics: PageSpeedMetrics;
  fieldData: CoreWebVitalsFieldData | null;
} | null> {
  const apiKey = Deno.env.get("GOOGLE_PAGESPEED_API_KEY");
  const endpoint = new URL(
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
  );
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy);
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
      `analyze_website: PageSpeed ${strategy} ${r.status} (försök ${attempt}/2) for ${url}: ${body}`,
    );
    if (attempt === 2 || (r.status !== 429 && r.status < 500)) {
      throw new Error(`PageSpeed API ${strategy} ${r.status}: ${body}`);
    }
  }
  if (!response) throw new Error("PageSpeed API returned no response");

  const result = await response.json();
  const lighthouse = result?.lighthouseResult;
  if (!lighthouse) return null;

  return {
    metrics: parseLighthouseMetrics(lighthouse),
    fieldData: parseFieldData(result),
  };
}

async function fetchPageSpeed(url: string): Promise<PageSpeedSummary | null> {
  // PageSpeed-API:t fungerar även utan nyckel (delad, låg kvot) — kör hellre
  // nyckellöst än att hoppa över källan. Med GOOGLE_PAGESPEED_API_KEY satt
  // får vi egen kvot (25k/dag).
  if (!Deno.env.get("GOOGLE_PAGESPEED_API_KEY")) {
    console.warn(
      "analyze_website: GOOGLE_PAGESPEED_API_KEY not set — running keyless with shared quota",
    );
  }

  // Mobil är primär (Google är mobile-first) och bär fältdatan. Desktop är
  // komplement och får ALDRIG fälla analysen — kör isolerat och svälj fel.
  const [mobile, desktop] = await Promise.all([
    fetchPageSpeedRun(url, "mobile"),
    fetchPageSpeedRun(url, "desktop").catch((error) => {
      console.warn(
        `analyze_website: desktop PageSpeed failed for ${url}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return null;
    }),
  ]);
  if (!mobile) return null;

  return {
    strategy: "mobile",
    ...mobile.metrics,
    desktop: desktop?.metrics ?? null,
    field_data: mobile.fieldData,
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

type SitemapSummary = {
  url_count: number;
  lastmod_newest: string | null; // YYYY-MM-DD, nyaste uppdaterade sidan
  stale_count: number; // antal URL:er ej uppdaterade på 180+ dagar
};

const STALE_AFTER_MS = 180 * 24 * 60 * 60 * 1000;

// Räknar <loc> och plockar parsbara <lastmod>-tidsstämplar ur ett sitemap-dokument.
function parseSitemapDoc(xml: string): { locs: number; lastmods: number[] } {
  const locs = (xml.match(/<loc>/gi) ?? []).length;
  const lastmods = [...xml.matchAll(/<lastmod>\s*([^<\s]+)/gi)]
    .map((match) => Date.parse(match[1]))
    .filter((time) => !Number.isNaN(time));
  return { locs, lastmods };
}

async function fetchSitemapText(url: string): Promise<string | null> {
  // Gzippade sitemaps (.xml.gz) kan vi inte läsa som text — returnera null
  // (okänt) i stället för att räkna 0 <loc> på binärdata och låtsas "tom".
  if (/\.gz(\?|$)/i.test(url)) return null;
  try {
    const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS, {
      redirect: "follow",
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (/gzip|octet-stream/i.test(contentType)) return null;
    // Skydda minnet — sitemaps är sällan stora, men kapa ändå.
    return (await response.text()).slice(0, 5_000_000);
  } catch {
    return null;
  }
}

/**
 * Sammanfattar sajtens sitemap: antal URL:er + innehållsfärskhet (nyaste
 * lastmod + hur många sidor som inte rörts på 180+ dagar). Hanterar
 * sitemap-index en nivå djupt (upp till 5 under-sitemaps parallellt för att
 * skydda tidsbudgeten). null = ingen läsbar sitemap.
 */
async function summarizeSitemap(
  origin: string,
  robotsBody: string,
): Promise<SitemapSummary | null> {
  const fromRobots = robotsBody.match(/sitemap:\s*(\S+)/i)?.[1];
  const sitemapUrl = fromRobots ?? `${origin}/sitemap.xml`;
  const xml = await fetchSitemapText(sitemapUrl);
  if (xml == null) return null;

  let urlCount = 0;
  const lastmods: number[] = [];

  if (/<sitemapindex/i.test(xml)) {
    const children = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)]
      .map((match) => {
        // Relativa <loc> (vanligt i WordPress/SSG) måste resolvas mot
        // sitemap-URL:en, annars kastar fetch på en relativ sökväg.
        try {
          return new URL(match[1], sitemapUrl).toString();
        } catch {
          return null;
        }
      })
      .filter((child): child is string => child != null)
      .slice(0, 5);
    const docs = await Promise.all(
      children.map(async (child) => {
        const childXml = await fetchSitemapText(child);
        return childXml ? parseSitemapDoc(childXml) : null;
      }),
    );
    for (const doc of docs) {
      if (!doc) continue;
      urlCount += doc.locs;
      lastmods.push(...doc.lastmods);
    }
  } else {
    const doc = parseSitemapDoc(xml);
    urlCount = doc.locs;
    lastmods.push(...doc.lastmods);
  }

  const staleThreshold = Date.now() - STALE_AFTER_MS;
  const newest = lastmods.length > 0 ? Math.max(...lastmods) : null;
  return {
    url_count: urlCount,
    lastmod_newest:
      newest != null ? new Date(newest).toISOString().slice(0, 10) : null,
    stale_count: lastmods.filter((time) => time < staleThreshold).length,
  };
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

  const [llmsExists, sitemap] = await Promise.all([
    probeExists(`${origin}/llms.txt`),
    summarizeSitemap(origin, robotsBody),
  ]);
  const sitemapExists = sitemap != null || /sitemap:/i.test(robotsBody);

  return {
    title: titleMatch?.[1]?.trim() || null,
    meta_description: metaDescMatch?.[1]?.trim() || null,
    og_tags: /<meta[^>]+property=["']og:/i.test(html),
    schema_org: /application\/ld\+json/i.test(html),
    sitemap: sitemapExists,
    sitemap_url_count: sitemap?.url_count ?? null,
    lastmod_newest: sitemap?.lastmod_newest ?? null,
    stale_count: sitemap?.stale_count ?? null,
    robots: robotsBody.length > 0,
    llms_txt: llmsExists,
    h1: /<h1[\s>]/i.test(html),
    indexable: !/noindex/i.test(`${metaRobots} ${xRobotsTag}`),
  };
}

// --- Konkurrentbenchmark (Fas 1E) ---

/**
 * Lättviktig konkurrentanalys: mobil-PageSpeed + on-page-crawl. Konkurrenter
 * ger inte GSC/GBP-åtkomst, så vi jämför bara det som går att mäta externt.
 * Mobil-only håller nere tid och PSI-kvot. Allt är icke-fatalt — en
 * konkurrent som felar utesluts bara ur listan.
 */
async function analyzeCompetitor(
  rawUrl: string,
): Promise<CompetitorSnapshot | null> {
  const url = normalizeUrl(rawUrl);
  const [run, seo] = await Promise.all([
    fetchPageSpeedRun(url, "mobile").catch(() => null),
    crawlSeoChecks(url).catch(() => null),
  ]);
  if (!run && !seo) return null;
  return {
    url,
    performance_score: run?.metrics.performance_score ?? null,
    seo_score: run?.metrics.seo_score ?? null,
    lcp_ms: run?.metrics.lcp_ms ?? null,
    cls: run?.metrics.cls ?? null,
    has_title: Boolean(seo?.title),
    has_schema: Boolean(seo?.schema_org),
    has_sitemap: Boolean(seo?.sitemap),
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
  brand: string[],
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

  const [
    totalsResponse,
    queriesResponse,
    pagesResponse,
    deviceResponse,
    countryResponse,
  ] = await Promise.all([
    analyticsQuery({}),
    analyticsQuery({ dimensions: ["query"], rowLimit: 250 }),
    analyticsQuery({ dimensions: ["page"], rowLimit: 10 }),
    analyticsQuery({ dimensions: ["device"] }),
    analyticsQuery({ dimensions: ["country"], rowLimit: 10 }),
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
  const deviceRows = deviceResponse.ok
    ? ((await deviceResponse.json()).rows ?? [])
    : [];
  const countryRows = countryResponse.ok
    ? ((await countryResponse.json()).rows ?? [])
    : [];
  type AnalyticsRow = {
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const normalizedQueries = (queryRows as AnalyticsRow[]).map((row) => ({
    query: row.keys?.[0] ?? "",
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: round1(row.position),
  }));
  const opportunities = classifySearchOpportunities(normalizedQueries);
  // Branded vs non-branded baseras på toppsökningarna (upp till 250 rader) —
  // GSC döljer long-tail/anonymiserade sökningar, så hinkarna summerar inte
  // nödvändigtvis till totalen. Det är ett riktmärke, inte en exakt fördelning.
  const brandedSplit = classifyBrandedQueries(normalizedQueries, brand);

  // Device-uppdelning: GSC-nycklar är MOBILE/DESKTOP/TABLET.
  const deviceBreakdown: SearchConsoleSummary["device_breakdown"] = {};
  for (const row of deviceRows as AnalyticsRow[]) {
    const key = (row.keys?.[0] ?? "").toLowerCase();
    if (key === "mobile" || key === "desktop" || key === "tablet") {
      deviceBreakdown[key] = {
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: round1(row.position),
      };
    }
  }

  // Geografi: nycklar är ISO-3166-1 alpha-3 i gemener (t.ex. "swe", "nor").
  const topCountries = (countryRows as AnalyticsRow[])
    .map((row) => ({
      country: row.keys?.[0] ?? "",
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: round1(row.position),
    }))
    .slice(0, 5);

  return {
    clicks: totals?.clicks ?? 0,
    impressions: totals?.impressions ?? 0,
    ctr: totals?.ctr ?? 0,
    position: totals?.position ?? 0,
    period_start: period.startDate,
    period_end: period.endDate,
    data_state: "final",
    // Topp 50 (av 250 hämtade) — ger sökordshistorik/-rörelser månad för
    // månad utan ny tabell. UI visar topp 10 men matchar rörelser mot fler.
    top_queries: normalizedQueries.slice(0, 50),
    top_pages: (pageRows as AnalyticsRow[]).map((row) => ({
      page: row.keys?.[0] ?? "",
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: round1(row.position),
    })),
    device_breakdown: deviceBreakdown,
    top_countries: topCountries,
    branded: brandedSplit.branded,
    non_branded: brandedSplit.non_branded,
    opportunities,
  };
}

// --- e) Google Business-åtgärder (Performance API, gated) ---

function ymd(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  return { year, month, day };
}

/**
 * Hämtar Google Business-åtgärder (samtal, webbklick, vägbeskrivningar) för
 * perioden. Gated och icke-fatal: kräver business.manage-credential OCH ett
 * ifyllt location-ID. Saknas något → null (visas som "ej konfigurerat").
 */
async function fetchGbpActions(
  locationId: string | null,
  period: VisibilityPeriod,
): Promise<GbpActions | null> {
  if (!locationId) return null;
  const token = await getGoogleAccessToken(
    "https://www.googleapis.com/auth/business.manage",
  );
  if (!token) return null;

  const loc = locationId.replace(/^locations\//, "").trim();
  if (!loc) return null;
  const start = ymd(period.startDate);
  const end = ymd(period.endDate);
  const metrics = [
    "CALL_CLICKS",
    "WEBSITE_CLICKS",
    "BUSINESS_DIRECTION_REQUESTS",
  ];

  const endpoint = new URL(
    `https://businessprofileperformance.googleapis.com/v1/locations/${loc}:fetchMultiDailyMetricsTimeSeries`,
  );
  for (const metric of metrics) {
    endpoint.searchParams.append("dailyMetrics", metric);
  }
  endpoint.searchParams.set("dailyRange.startDate.year", String(start.year));
  endpoint.searchParams.set("dailyRange.startDate.month", String(start.month));
  endpoint.searchParams.set("dailyRange.startDate.day", String(start.day));
  endpoint.searchParams.set("dailyRange.endDate.year", String(end.year));
  endpoint.searchParams.set("dailyRange.endDate.month", String(end.month));
  endpoint.searchParams.set("dailyRange.endDate.day", String(end.day));

  const response = await fetchWithTimeout(
    endpoint.toString(),
    FETCH_TIMEOUT_MS,
    {
      headers: googleApiHeaders(token),
    },
  );
  if (!response.ok) {
    console.warn(
      `analyze_website: GBP actions ${response.status} for ${loc}: ${(await response.text()).slice(0, 200)}`,
    );
    return null;
  }

  const data = await response.json();
  const groups = (data?.multiDailyMetricTimeSeries ?? []) as Array<{
    dailyMetricTimeSeries?: Array<{
      dailyMetric?: string;
      timeSeries?: { datedValues?: Array<{ value?: string | number }> };
    }>;
  }>;
  const totals: Record<string, number> = {};
  for (const group of groups) {
    for (const entry of group.dailyMetricTimeSeries ?? []) {
      const metric = entry.dailyMetric ?? "";
      const sum = (entry.timeSeries?.datedValues ?? []).reduce(
        (acc, dated) => acc + (Number(dated.value) || 0),
        0,
      );
      totals[metric] = (totals[metric] ?? 0) + sum;
    }
  }
  return {
    calls: totals.CALL_CLICKS ?? 0,
    website_clicks: totals.WEBSITE_CLICKS ?? 0,
    direction_requests: totals.BUSINESS_DIRECTION_REQUESTS ?? 0,
    period_start: period.startDate,
    period_end: period.endDate,
  };
}

// --- f) Lokal map-pack-rank (DataForSEO, gated) ---

/**
 * Hämtar kundens placering i Googles kartpaket per lokalt sökord via DataForSEO.
 * Gated + icke-fatal: kräver DATAFORSEO_LOGIN/PASSWORD OCH ifyllda sökord.
 * Max 3 sökord, parallellt, för att hålla kostnad och tidsbudget i schack.
 */
async function fetchLocalRank(
  keywords: string[],
  company: { name: string; website: string | null; city: string | null },
): Promise<LocalRankResult[] | null> {
  if (!keywords.length) return null;
  const login = Deno.env.get("DATAFORSEO_LOGIN");
  const password = Deno.env.get("DATAFORSEO_PASSWORD");
  if (!login || !password) return null;
  const auth = btoa(`${login}:${password}`);
  const locationName = company.city ? `${company.city},Sweden` : "Sweden";

  return await Promise.all(
    keywords.slice(0, 3).map(async (keyword): Promise<LocalRankResult> => {
      try {
        const response = await fetchWithTimeout(
          "https://api.dataforseo.com/v3/serp/google/local_finder/live/advanced",
          PAGESPEED_TIMEOUT_MS,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify([
              {
                keyword,
                location_name: locationName,
                language_code: "sv",
                device: "mobile",
              },
            ]),
          },
        );
        if (!response.ok) {
          console.warn(
            `analyze_website: DataForSEO ${response.status} for "${keyword}": ${(await response.text()).slice(0, 200)}`,
          );
          return { keyword, position: null, found: false };
        }
        const data = await response.json();
        const items = data?.tasks?.[0]?.result?.[0]?.items ?? [];
        const { position, found } = findLocalPosition(items, {
          website: company.website,
          name: company.name,
        });
        return { keyword, position, found };
      } catch (error) {
        console.warn(
          `analyze_website: DataForSEO failed for "${keyword}": ${
            error instanceof Error ? error.message : error
          }`,
        );
        return { keyword, position: null, found: false };
      }
    }),
  );
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
    .select(
      "delivered_website_url, competitor_urls, gbp_location_id, local_rank_keywords",
    )
    .eq("company_id", companyId)
    .maybeSingle();

  const rawUrl = details?.delivered_website_url || company.website;
  if (!rawUrl) {
    throw new Error(
      `Company ${companyId} has no website to analyze (customer_details.delivered_website_url and companies.website are both empty)`,
    );
  }
  const url = normalizeUrl(rawUrl);
  // Varumärkes-tokens för branded/non-branded-klassning av sökord.
  const brand = brandTokens(company.name, company.website);
  // Konkurrenter (max 3 för att hålla PSI-kvot och tidsbudget i schack).
  const competitorUrls = Array.isArray(details?.competitor_urls)
    ? (details.competitor_urls as unknown[])
        .filter(
          (entry): entry is string =>
            typeof entry === "string" && entry.trim().length > 0,
        )
        .slice(0, 3)
    : [];

  const gbpLocationId =
    typeof details?.gbp_location_id === "string"
      ? details.gbp_location_id
      : null;
  // Lokala sökord för map-pack-rank (max 3).
  const localRankKeywords = Array.isArray(details?.local_rank_keywords)
    ? (details.local_rank_keywords as unknown[])
        .filter(
          (entry): entry is string =>
            typeof entry === "string" && entry.trim().length > 0,
        )
        .slice(0, 3)
    : [];

  const [
    pageSpeedResult,
    seoResult,
    businessResult,
    searchResult,
    competitors,
    gbpActions,
    localRank,
  ] = await Promise.all([
    inspectSource("pagespeed", fetchPageSpeed(url)),
    inspectSource("seo_crawl", crawlSeoChecks(url)),
    inspectSource("business_profile", fetchBusinessProfile(company)),
    inspectSource("search_console", fetchSearchConsole(url, period, brand)),
    Promise.all(competitorUrls.map((u) => analyzeCompetitor(u))).then((rows) =>
      rows.filter((row): row is CompetitorSnapshot => row != null),
    ),
    fetchGbpActions(gbpLocationId, period).catch((error) => {
      console.warn(
        `analyze_website: GBP actions failed: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return null;
    }),
    fetchLocalRank(localRankKeywords, {
      name: company.name,
      website: company.website,
      city: company.city,
    }).catch((error) => {
      console.warn(
        `analyze_website: local rank failed: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return null;
    }),
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
        fcp_ms: pagespeed.fcp_ms,
        speed_index_ms: pagespeed.speed_index_ms,
        tti_ms: pagespeed.tti_ms,
        opportunities: pagespeed.opportunities,
        desktop: pagespeed.desktop ?? null,
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
    competitors: competitors.length > 0 ? competitors : null,
    gbp_actions: gbpActions,
    local_rank: localRank && localRank.length > 0 ? localRank : null,
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
