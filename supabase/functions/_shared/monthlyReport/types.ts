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
  period_start?: string | null;
  period_end?: string | null;
  window_kind?: "legacy" | "rolling_28d" | "calendar_month";
  data_coverage?: {
    available_sources?: number;
    total_sources?: number;
    ratio?: number;
    has_search_console?: boolean;
    has_field_data?: boolean;
  };
  source_status?: Record<
    string,
    { status: "available" | "unavailable" | "error"; message?: string }
  >;
  performance_score?: number | null;
  seo_score?: number | null;
  pagespeed?: {
    lcp_ms?: number | null;
    cls?: number | null;
    tbt_ms?: number | null;
  } | null;
  field_data?: {
    scope: "url" | "origin";
    lcp_ms?: number | null;
    inp_ms?: number | null;
    cls?: number | null;
    lcp_rating?: "GOOD" | "NEEDS_IMPROVEMENT" | "POOR" | null;
    inp_rating?: "GOOD" | "NEEDS_IMPROVEMENT" | "POOR" | null;
    cls_rating?: "GOOD" | "NEEDS_IMPROVEMENT" | "POOR" | null;
  } | null;
  seo_checks?: {
    schema_org?: boolean;
    sitemap?: boolean;
    h1?: boolean;
    title?: string | null;
    meta_description?: string | null;
    indexable?: boolean | null;
    robots?: boolean;
    og_tags?: boolean;
  } | null;
  business_profile?: {
    found: boolean;
    rating?: number | null;
    reviews_count?: number | null;
  } | null;
  search_console?: {
    clicks: number;
    impressions: number;
    ctr?: number;
    position: number;
    period_start?: string;
    period_end?: string;
    top_queries: Array<{
      query: string;
      clicks: number;
      impressions: number;
      ctr?: number;
      position: number;
    }>;
    top_pages?: Array<{
      page: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>;
    opportunities?: Array<{
      kind: "low_ctr" | "position_4_10" | "position_11_20";
      query: string;
      clicks: number;
      impressions: number;
      ctr: number;
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
  field_lcp_ms: MetricTrend;
  field_inp_ms: MetricTrend;
  field_cls: MetricTrend;
  reviews_count: MetricTrend;
  /** Topp-sökningar från senaste snapshoten (för "vilka ord driver trafik"). */
  topQueries: Array<{ query: string; clicks: number; position: number }>;
  topPages: Array<{
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  opportunities: NonNullable<
    NonNullable<ReportSnapshot["search_console"]>["opportunities"]
  >;
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

export type ReportStatus = "good" | "needs_attention" | "poor" | "missing";

export type ReportViewModel = {
  version: 2;
  companyName: string;
  period: { start: string; end: string; label: string };
  comparisonPeriod: { start: string; end: string } | null;
  coverage: {
    available: number;
    total: number;
    ratio: number;
    missingSources: string[];
  };
  metrics: ReportMetrics;
  statuses: {
    googleVisibility: ReportStatus;
    pageExperience: ReportStatus;
    localVisibility: ReportStatus;
    technicalFoundation: ReportStatus;
  };
  technicalChecks: Array<{
    key: string;
    label: string;
    passed: boolean | null;
    explanation: string;
  }>;
  recommendations: ReportFinding[];
  primaryRecommendation: ReportFinding | null;
};
