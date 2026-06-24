import type {
  CustomerPerformanceCategory,
  CustomerPortfolioTrendPoint,
  CustomerPortfolioViewModel,
  CustomerReportDeliveryStatus,
  CustomerVisibilityDashboardResponse,
  CustomerVisibilityReason,
  MonthlyReport,
  ReportStatus,
  ReportViewModel,
  WebsiteSnapshot,
} from "../types";

const MONTH_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const SOURCE_LABELS: Record<string, string> = {
  pagespeed: "PageSpeed",
  seo_crawl: "Teknisk SEO",
  business_profile: "Google Business",
  search_console: "Search Console",
};

function metricTrend(
  current: number | null | undefined,
  previous: number | null | undefined,
) {
  const currentValue = current ?? null;
  const previousValue = previous ?? null;
  return {
    current: currentValue,
    previous: previousValue,
    deltaPct:
      currentValue != null && previousValue != null && previousValue !== 0
        ? ((currentValue - previousValue) / previousValue) * 100
        : null,
    deltaAbsolute:
      currentValue != null && previousValue != null
        ? currentValue - previousValue
        : null,
  };
}

function googleStatus(snapshot: WebsiteSnapshot): ReportStatus {
  const search = snapshot.search_console;
  if (!search) return "missing";
  if (search.impressions === 0 || search.position > 20) return "poor";
  const ctr =
    search.ctr ??
    (search.impressions > 0 ? search.clicks / search.impressions : 0);
  return search.position > 10 || (search.impressions >= 50 && ctr < 0.02)
    ? "needs_attention"
    : "good";
}

function pageExperienceStatus(snapshot: WebsiteSnapshot): ReportStatus {
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

function localStatus(snapshot: WebsiteSnapshot): ReportStatus {
  const profile = snapshot.business_profile;
  if (!profile) return "missing";
  if (!profile.found) return "poor";
  if (
    (profile.reviews_count != null && profile.reviews_count < 5) ||
    (profile.rating != null && profile.rating < 4)
  ) {
    return "needs_attention";
  }
  return "good";
}

function technicalStatus(snapshot: WebsiteSnapshot): ReportStatus {
  const checks = snapshot.seo_checks;
  if (!checks) return "missing";
  const values = [
    checks.indexable !== false,
    Boolean(checks.title),
    Boolean(checks.meta_description),
    Boolean(checks.h1),
    Boolean(checks.sitemap),
    Boolean(checks.robots),
    Boolean(checks.schema_org),
    Boolean(checks.og_tags),
  ];
  const failed = values.filter((value) => !value).length;
  if (failed >= 3) return "poor";
  if (failed > 0) return "needs_attention";
  return "good";
}

function fallbackViewModel(
  companyName: string,
  latest: WebsiteSnapshot,
  previous: WebsiteSnapshot | null,
): ReportViewModel {
  const sourceEntries = Object.entries(latest.source_status ?? {});
  const missingSources = sourceEntries
    .filter(([, source]) => source.status !== "available")
    .map(([key]) => SOURCE_LABELS[key] ?? key);
  const available =
    latest.data_coverage?.available_sources ??
    Math.max(0, sourceEntries.length - missingSources.length);
  const total = latest.data_coverage?.total_sources ?? 4;
  const latestSearch = latest.search_console;
  const previousSearch = previous?.search_console;

  return {
    version: 2,
    companyName,
    period: {
      start: latest.period_start ?? "",
      end: latest.period_end ?? "",
      label: formatPeriod(latest.period_start ?? ""),
    },
    comparisonPeriod:
      previous?.period_start && previous.period_end
        ? { start: previous.period_start, end: previous.period_end }
        : null,
    coverage: {
      available,
      total,
      ratio: total > 0 ? available / total : 0,
      missingSources,
    },
    metrics: {
      clicks: metricTrend(latestSearch?.clicks, previousSearch?.clicks),
      impressions: metricTrend(
        latestSearch?.impressions,
        previousSearch?.impressions,
      ),
      ctr: metricTrend(latestSearch?.ctr, previousSearch?.ctr),
      position: metricTrend(
        latestSearch?.position,
        previousSearch?.position,
      ),
      performance_score: metricTrend(
        latest.performance_score,
        previous?.performance_score,
      ),
      lcp_ms: metricTrend(
        latest.pagespeed?.lcp_ms,
        previous?.pagespeed?.lcp_ms,
      ),
      field_lcp_ms: metricTrend(
        latest.field_data?.lcp_ms,
        previous?.field_data?.lcp_ms,
      ),
      field_inp_ms: metricTrend(
        latest.field_data?.inp_ms,
        previous?.field_data?.inp_ms,
      ),
      field_cls: metricTrend(
        latest.field_data?.cls,
        previous?.field_data?.cls,
      ),
      reviews_count: metricTrend(
        latest.business_profile?.reviews_count,
        previous?.business_profile?.reviews_count,
      ),
      topQueries:
        latestSearch?.top_queries.map(({ query, clicks, position }) => ({
          query,
          clicks,
          position,
        })) ?? [],
      topPages: latestSearch?.top_pages ?? [],
      opportunities: latestSearch?.opportunities ?? [],
      isFirstReport: !previous,
    },
    statuses: {
      googleVisibility: googleStatus(latest),
      pageExperience: pageExperienceStatus(latest),
      localVisibility: localStatus(latest),
      technicalFoundation: technicalStatus(latest),
    },
    technicalChecks: [],
    recommendations: latest.findings ?? [],
    primaryRecommendation: latest.findings?.[0] ?? null,
  };
}

function reportStatus(
  report: MonthlyReport | null,
): CustomerReportDeliveryStatus {
  if (!report) return "missing";
  if (report.status === "sent") return "sent";
  if (report.status === "failed" || report.status === "skipped") return "failed";
  return "draft";
}

function classifyCustomer(
  viewModel: ReportViewModel | null,
  current: WebsiteSnapshot | null,
  previous: WebsiteSnapshot | null,
): {
  category: CustomerPerformanceCategory;
  reasons: CustomerVisibilityReason[];
} {
  if (!current || !viewModel || viewModel.coverage.available === 0) {
    return {
      category: "missing",
      reasons: [{ tone: "neutral", label: "Officiell månadsdata saknas" }],
    };
  }

  const reasons: CustomerVisibilityReason[] = [];
  const statuses = Object.values(viewModel.statuses);
  const highFindings = current.findings.filter(
    (finding) => finding.severity === "high",
  );
  const mediumFindings = current.findings.filter(
    (finding) => finding.severity === "medium",
  );
  const sourceErrors = Object.values(current.source_status ?? {}).filter(
    (source) => source.status === "error",
  );
  const clicks = current.search_console?.clicks;
  const previousClicks = previous?.search_console?.clicks;
  const clickDelta =
    clicks != null && previousClicks != null && previousClicks >= 10
      ? ((clicks - previousClicks) / previousClicks) * 100
      : null;
  const positionDelta =
    current.search_console && previous?.search_console
      ? current.search_console.position - previous.search_console.position
      : null;

  if (clickDelta != null && Math.abs(clickDelta) >= 5) {
    reasons.push({
      tone: clickDelta > 0 ? "positive" : "negative",
      label: `${Math.abs(Math.round(clickDelta))} % ${clickDelta > 0 ? "fler" : "färre"} Google-klick`,
    });
  }
  if (positionDelta != null && Math.abs(positionDelta) >= 1) {
    reasons.push({
      tone: positionDelta < 0 ? "positive" : "negative",
      label: `Snittpositionen ${positionDelta < 0 ? "förbättrades" : "försämrades"} ${Math.abs(positionDelta).toFixed(1)} steg`,
    });
  }
  if (highFindings[0]) {
    reasons.push({ tone: "negative", label: highFindings[0].title });
  } else if (mediumFindings[0]) {
    reasons.push({ tone: "negative", label: mediumFindings[0].title });
  }
  if (viewModel.coverage.ratio < 1) {
    reasons.push({
      tone: "neutral",
      label: `${viewModel.coverage.available} av ${viewModel.coverage.total} datakällor`,
    });
  }

  if (
    highFindings.length > 0 ||
    current.seo_checks?.indexable === false ||
    statuses.filter((status) => status === "poor").length >= 2 ||
    sourceErrors.length >= 2
  ) {
    return {
      category: "poor",
      reasons: reasons.slice(0, 3),
    };
  }

  if (
    statuses.includes("poor") ||
    statuses.includes("needs_attention") ||
    mediumFindings.length > 0 ||
    (clickDelta != null && clickDelta <= -20) ||
    (positionDelta != null && positionDelta >= 2)
  ) {
    return {
      category: "watch",
      reasons: reasons.slice(0, 3),
    };
  }

  const allMeasuredStatusesGood = statuses
    .filter((status) => status !== "missing")
    .every((status) => status === "good");
  if (
    viewModel.coverage.ratio >= 0.75 &&
    allMeasuredStatusesGood &&
    clickDelta != null &&
    clickDelta >= 20
  ) {
    return {
      category: "very_good",
      reasons: reasons.length
        ? reasons.slice(0, 3)
        : [{ tone: "positive", label: "Stark och stabil utveckling" }],
    };
  }

  return {
    category: "good",
    reasons: reasons.length
      ? reasons.slice(0, 3)
      : [{ tone: "positive", label: "Inga tydliga varningssignaler" }],
  };
}

function worstCwvRating(snapshot: WebsiteSnapshot | null) {
  const ratings = [
    snapshot?.field_data?.lcp_rating,
    snapshot?.field_data?.inp_rating,
    snapshot?.field_data?.cls_rating,
  ];
  if (ratings.includes("POOR")) return "POOR";
  if (ratings.includes("NEEDS_IMPROVEMENT")) return "NEEDS_IMPROVEMENT";
  if (ratings.includes("GOOD")) return "GOOD";
  return null;
}

function buildTrends(
  rows: CustomerVisibilityDashboardResponse["rows"],
): CustomerPortfolioTrendPoint[] {
  const byPeriod = new Map<string, WebsiteSnapshot[]>();
  for (const row of rows) {
    for (const snapshot of row.history) {
      if (!snapshot.period_start) continue;
      const periodRows = byPeriod.get(snapshot.period_start) ?? [];
      periodRows.push(snapshot);
      byPeriod.set(snapshot.period_start, periodRows);
    }
  }

  return [...byPeriod.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, snapshots]) => {
      const search = snapshots.flatMap((snapshot) =>
        snapshot.search_console ? [snapshot.search_console] : [],
      );
      const impressions = search.reduce(
        (sum, metric) => sum + metric.impressions,
        0,
      );
      const clicks = search.reduce((sum, metric) => sum + metric.clicks, 0);
      const performance = snapshots.flatMap((snapshot) =>
        snapshot.performance_score != null
          ? [snapshot.performance_score]
          : [],
      );
      const gbpActions = snapshots.flatMap((snapshot) =>
        snapshot.gbp_actions
          ? [
              snapshot.gbp_actions.calls +
                snapshot.gbp_actions.website_clicks +
                snapshot.gbp_actions.direction_requests,
            ]
          : [],
      );
      return {
        period,
        customers: snapshots.length,
        clicks: search.length ? clicks : null,
        impressions: search.length ? impressions : null,
        ctr: impressions > 0 ? clicks / impressions : null,
        position:
          impressions > 0
            ? search.reduce(
                (sum, metric) => sum + metric.position * metric.impressions,
                0,
              ) / impressions
            : null,
        performance: performance.length
          ? performance.reduce((sum, value) => sum + value, 0) /
            performance.length
          : null,
        gbpActions: gbpActions.length
          ? gbpActions.reduce((sum, value) => sum + value, 0)
          : null,
      };
    });
}

export function formatPeriod(period: string): string {
  if (!period) return "Okänd period";
  return MONTH_FORMATTER.format(new Date(`${period}T00:00:00Z`));
}

export function previousCompleteMonth(referenceDate = new Date()): string {
  return new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - 1, 1),
  )
    .toISOString()
    .slice(0, 10);
}

export function buildCustomerPortfolioViewModel(
  response: CustomerVisibilityDashboardResponse,
): CustomerPortfolioViewModel {
  const rows = response.rows.map((row) => {
    const reportViewModel =
      row.report?.view_model &&
      row.report.view_model.period.start === response.period.start
        ? row.report.view_model
        : null;
    const viewModel =
      reportViewModel ??
      (row.current_snapshot
        ? fallbackViewModel(
            row.company_name,
            row.current_snapshot,
            row.previous_snapshot,
          )
        : null);
    const classification = classifyCustomer(
      viewModel,
      row.current_snapshot,
      row.previous_snapshot,
    );
    return {
      companyId: row.company_id,
      companyName: row.company_name,
      websiteUrl: row.delivered_website_url,
      launchDate: row.launch_date ?? null,
      category: classification.category,
      reasons: classification.reasons,
      currentSnapshot: row.current_snapshot,
      previousSnapshot: row.previous_snapshot,
      report: row.report,
      reportStatus: reportStatus(row.report),
      viewModel,
      history: row.history,
    };
  });

  const counts = {
    very_good: 0,
    good: 0,
    watch: 0,
    poor: 0,
    missing: 0,
  } satisfies Record<CustomerPerformanceCategory, number>;
  const reports = {
    sent: 0,
    draft: 0,
    missing: 0,
    failed: 0,
  } satisfies Record<CustomerReportDeliveryStatus, number>;
  for (const row of rows) {
    counts[row.category] += 1;
    reports[row.reportStatus] += 1;
  }

  const searchRows = rows.flatMap((row) =>
    row.currentSnapshot?.search_console
      ? [row.currentSnapshot.search_console]
      : [],
  );
  const impressions = searchRows.reduce(
    (sum, metric) => sum + metric.impressions,
    0,
  );
  const clicks = searchRows.reduce((sum, metric) => sum + metric.clicks, 0);
  const performance = rows.flatMap((row) =>
    row.currentSnapshot?.performance_score != null
      ? [row.currentSnapshot.performance_score]
      : [],
  );
  const profiles = rows.flatMap((row) =>
    row.currentSnapshot?.business_profile?.found &&
    row.currentSnapshot.business_profile.rating != null
      ? [row.currentSnapshot.business_profile]
      : [],
  );
  const reviewValues = profiles.flatMap((profile) =>
    profile.reviews_count != null ? [profile.reviews_count] : [],
  );
  const gbpActions = rows.flatMap((row) =>
    row.currentSnapshot?.gbp_actions
      ? [
          row.currentSnapshot.gbp_actions.calls +
            row.currentSnapshot.gbp_actions.website_clicks +
            row.currentSnapshot.gbp_actions.direction_requests,
        ]
      : [],
  );
  const comparableRows = rows.filter(
    (row) =>
      row.currentSnapshot?.search_console &&
      row.previousSnapshot?.search_console &&
      row.previousSnapshot.search_console.clicks >= 10,
  );
  const cwvRows = rows.filter(
    (row) => worstCwvRating(row.currentSnapshot) != null,
  );

  return {
    period: {
      ...response.period,
      label: formatPeriod(response.period.start),
    },
    previousPeriod: response.previous_period,
    rows,
    counts,
    reports,
    metrics: {
      customers: rows.length,
      improved: comparableRows.filter(
        (row) =>
          row.currentSnapshot!.search_console!.clicks >
          row.previousSnapshot!.search_console!.clicks,
      ).length,
      declined: comparableRows.filter(
        (row) =>
          row.currentSnapshot!.search_console!.clicks <
          row.previousSnapshot!.search_console!.clicks,
      ).length,
      clicks: searchRows.length ? clicks : null,
      impressions: searchRows.length ? impressions : null,
      ctr: impressions > 0 ? clicks / impressions : null,
      position:
        impressions > 0
          ? searchRows.reduce(
              (sum, metric) => sum + metric.position * metric.impressions,
              0,
            ) / impressions
          : null,
      performance: performance.length
        ? performance.reduce((sum, value) => sum + value, 0) /
          performance.length
        : null,
      healthyCoreWebVitals: cwvRows.filter(
        (row) => worstCwvRating(row.currentSnapshot!) === "GOOD",
      ).length,
      coreWebVitalsCustomers: cwvRows.length,
      googleBusinessRating: profiles.length
        ? profiles.reduce((sum, profile) => sum + (profile.rating ?? 0), 0) /
          profiles.length
        : null,
      googleBusinessCustomers: profiles.length,
      reviews: reviewValues.length
        ? reviewValues.reduce((sum, value) => sum + value, 0)
        : null,
      gbpActions: gbpActions.length
        ? gbpActions.reduce((sum, value) => sum + value, 0)
        : null,
      gbpActionCustomers: gbpActions.length,
      searchCustomers: searchRows.length,
    },
    trends: buildTrends(response.rows),
  };
}
