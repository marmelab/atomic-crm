import type {
  ReportAiContent,
  ReportSnapshot,
  ReportStatus,
  ReportViewModel,
} from "./types.ts";
import { computeReportMetrics } from "./computeReportMetrics.ts";
import { CUSTOMER_HIDDEN_FINDING_KEYS } from "./buildReportEmailHtml.ts";

const SOURCE_LABELS: Record<string, string> = {
  pagespeed: "PageSpeed",
  seo_crawl: "Teknisk SEO",
  business_profile: "Google Business",
  search_console: "Google Search Console",
};

function googleStatus(snapshot: ReportSnapshot): ReportStatus {
  const search = snapshot.search_console;
  if (!search) return "missing";
  if (search.impressions === 0 || search.position > 20) return "poor";
  const ctr =
    search.ctr ??
    (search.impressions > 0 ? search.clicks / search.impressions : 0);
  if (search.position > 10 || (search.impressions >= 50 && ctr < 0.02)) {
    return "needs_attention";
  }
  return "good";
}

function pageExperienceStatus(snapshot: ReportSnapshot): ReportStatus {
  const field = snapshot.field_data;
  if (field) {
    const ratings = [field.lcp_rating, field.inp_rating, field.cls_rating];
    if (ratings.includes("POOR")) return "poor";
    if (ratings.includes("NEEDS_IMPROVEMENT")) return "needs_attention";
    if (ratings.some(Boolean)) return "good";
  }
  if (snapshot.performance_score == null) return "missing";
  if (snapshot.performance_score < 50) return "poor";
  if (snapshot.performance_score < 80) return "needs_attention";
  return "good";
}

function localStatus(snapshot: ReportSnapshot): ReportStatus {
  const business = snapshot.business_profile;
  if (!business) return "missing";
  if (!business.found) return "poor";
  if (
    (business.reviews_count != null && business.reviews_count < 5) ||
    (business.rating != null && business.rating < 4)
  ) {
    return "needs_attention";
  }
  return "good";
}

function technicalChecks(snapshot: ReportSnapshot) {
  const checks = snapshot.seo_checks;
  return [
    {
      key: "indexable",
      label: "Indexerbar",
      passed: checks ? checks.indexable !== false : null,
      explanation: "Avgör om Google får lägga till sidan i sökresultatet.",
    },
    {
      key: "title",
      label: "Sidtitel",
      passed: checks ? Boolean(checks.title) : null,
      explanation: "Beskriver sidan för både sökmotorer och besökare.",
    },
    {
      key: "meta_description",
      label: "Metabeskrivning",
      passed: checks ? Boolean(checks.meta_description) : null,
      explanation: "Påverkar hur attraktivt sökresultatet blir att klicka på.",
    },
    {
      key: "h1",
      label: "Huvudrubrik",
      passed: checks ? Boolean(checks.h1) : null,
      explanation: "Gör sidans huvudämne tydligt.",
    },
    {
      key: "sitemap",
      label: "Sitemap",
      passed: checks ? Boolean(checks.sitemap) : null,
      explanation: "Hjälper Google hitta sajtens sidor.",
    },
    {
      key: "robots",
      label: "Robots.txt",
      passed: checks ? Boolean(checks.robots) : null,
      explanation: "Styr vilka delar av sajten sökmotorer får läsa.",
    },
    {
      key: "schema_org",
      label: "Strukturerad data",
      passed: checks ? Boolean(checks.schema_org) : null,
      explanation: "Hjälper Google och AI-tjänster förstå verksamheten.",
    },
    {
      key: "og_tags",
      label: "Delningsmetadata",
      passed: checks ? Boolean(checks.og_tags) : null,
      explanation: "Ger professionella länkar i sociala medier och chattar.",
    },
  ];
}

function technicalStatus(
  checks: ReturnType<typeof technicalChecks>,
): ReportStatus {
  if (checks.every((check) => check.passed == null)) return "missing";
  const failed = checks.filter((check) => check.passed === false).length;
  if (failed >= 3) return "poor";
  if (failed > 0) return "needs_attention";
  return "good";
}

export function buildReportViewModel(input: {
  companyName: string;
  periodLabel: string;
  latest: ReportSnapshot;
  previous: ReportSnapshot | null;
}): ReportViewModel {
  const { latest, previous } = input;
  const checks = technicalChecks(latest);
  const hidden = new Set(CUSTOMER_HIDDEN_FINDING_KEYS);
  const recommendations = (latest.findings ?? []).filter(
    (finding) => !hidden.has(finding.key),
  );
  const sourceEntries = Object.entries(latest.source_status ?? {});
  const missingSources = sourceEntries
    .filter(([, state]) => state.status !== "available")
    .map(([key]) => SOURCE_LABELS[key] ?? key);
  const available =
    latest.data_coverage?.available_sources ??
    Math.max(0, sourceEntries.length - missingSources.length);
  const total = latest.data_coverage?.total_sources ?? 4;

  return {
    version: 2,
    companyName: input.companyName,
    period: {
      start: latest.period_start ?? "",
      end: latest.period_end ?? "",
      label: input.periodLabel,
    },
    comparisonPeriod:
      previous?.period_start && previous?.period_end
        ? { start: previous.period_start, end: previous.period_end }
        : null,
    coverage: {
      available,
      total,
      ratio: total > 0 ? available / total : 0,
      missingSources,
    },
    metrics: computeReportMetrics(latest, previous),
    statuses: {
      googleVisibility: googleStatus(latest),
      pageExperience: pageExperienceStatus(latest),
      localVisibility: localStatus(latest),
      technicalFoundation: technicalStatus(checks),
    },
    technicalChecks: checks,
    recommendations,
    primaryRecommendation: recommendations[0] ?? null,
  };
}

function trendPhrase(value: number | null): string {
  if (value == null) return "utan säker jämförelse mot månaden före";
  if (Math.abs(value) < 0.5) return "på ungefär samma nivå som månaden före";
  return value > 0
    ? `${Math.round(value)} % högre än månaden före`
    : `${Math.abs(Math.round(value))} % lägre än månaden före`;
}

export function buildFallbackReportContent(
  viewModel: ReportViewModel,
  recipientName: string | null,
): ReportAiContent {
  const metrics = viewModel.metrics;
  const searchSummary =
    metrics.clicks.current != null
      ? `Under ${viewModel.period.label} gav Google ${metrics.clicks.current.toLocaleString("sv-SE")} besök till er webbplats, ${trendPhrase(metrics.clicks.deltaPct)}.`
      : `Under ${viewModel.period.label} kunde vi inte läsa fullständig sökdata, men rapporten visar sidans tekniska och lokala nuläge.`;
  const recommendation = viewModel.primaryRecommendation;
  return {
    greeting: recipientName?.trim()
      ? `Hej ${recipientName.trim().split(/\s+/)[0]},`
      : "Hej,",
    summary: searchSummary,
    recommended_action: recommendation
      ? `Vi rekommenderar att börja med: ${recommendation.title.toLowerCase()}.`
      : "Vi rekommenderar att fortsätta följa utvecklingen och göra en riktad innehållsförbättring under nästa månad.",
    upsell_pitch: recommendation
      ? `${recommendation.description} Det här hanterar vi inom ${recommendation.service}.`
      : "Sajten har inga tydliga kritiska brister i de källor som kunde analyseras.",
  };
}
