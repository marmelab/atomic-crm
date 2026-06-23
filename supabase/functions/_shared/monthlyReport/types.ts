/**
 * Delade typer för månadsrapporten. Speglar jsonb-formerna i website_snapshots
 * (se findings.ts + migration 20260611150000) men hålls fristående här så att de
 * rena modulerna kan unit-testas utan att importera analyze_website-funktionen.
 */

export type FindingSeverity = "high" | "medium" | "low";

export type ReportFinding = {
  key: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  /** Axona-tjänsten som löser bristen — nyckeln mot upsell-katalogen. */
  service: string;
};

/** Delmängd av en website_snapshots-rad som rapporten behöver. */
export type ReportSnapshot = {
  id?: number;
  fetched_at?: string;
  performance_score?: number | null;
  seo_score?: number | null;
  pagespeed?: {
    lcp_ms?: number | null;
    cls?: number | null;
    tbt_ms?: number | null;
  } | null;
  seo_checks?: {
    schema_org?: boolean;
    sitemap?: boolean;
    h1?: boolean;
    title?: string | null;
    meta_description?: string | null;
  } | null;
  business_profile?: {
    found: boolean;
    rating?: number | null;
    reviews_count?: number | null;
  } | null;
  search_console?: {
    clicks: number;
    impressions: number;
    position: number;
    top_queries: Array<{
      query: string;
      clicks: number;
      impressions: number;
      position: number;
    }>;
  } | null;
  findings?: ReportFinding[];
};

/**
 * Trend för ett enskilt mått. `deltaPct` är null när föregående saknas (första
 * månaden) eller är 0. `deltaAbsolute` används för mått där procent är
 * missvisande (t.ex. snittposition, som mäts i heltalssteg).
 */
export type MetricTrend = {
  current: number | null;
  previous: number | null;
  deltaPct: number | null;
  deltaAbsolute: number | null;
};

export type ReportMetrics = {
  clicks: MetricTrend;
  impressions: MetricTrend;
  ctr: MetricTrend;
  position: MetricTrend;
  performance_score: MetricTrend;
  lcp_ms: MetricTrend;
  reviews_count: MetricTrend;
  /** Topp-sökningar från senaste snapshoten (för "vilka ord driver trafik"). */
  topQueries: Array<{ query: string; clicks: number; position: number }>;
  /** True när det inte fanns någon föregående snapshot (ingen trend att visa). */
  isFirstReport: boolean;
};

/** En upsell-post i katalogen (utan pris — pris tas i dialog, per beslut). */
export type UpsellOffer = {
  /** Matchar finding.service-strängen (SERVICES-värdet i findings.ts). */
  service: string;
  label: string;
  /** En mening kunden förstår. */
  description: string;
  /** Pitch-vinkel för säljaren/AI:n. */
  pitch: string;
};

/** AI-genererat, kundvänt innehåll. Speglar monthlyReportContentSchema. */
export type ReportAiContent = {
  greeting: string;
  summary: string;
  recommended_action: string;
  upsell_pitch: string;
};
