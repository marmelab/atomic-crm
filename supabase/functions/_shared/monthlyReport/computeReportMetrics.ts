/**
 * computeReportMetrics — ren modul (vitest-bar).
 *
 * Tar senaste snapshoten + den föregående (eller null första månaden) och
 * bygger ett trend-objekt per mått. Backend-motsvarighet till delta-logiken som
 * WebsiteStatsSection.tsx redan gör i frontend med perPage:2.
 *
 * Position (snittposition i Google) mäts i heltalssteg där LÄGRE är bättre —
 * därför rapporteras den som deltaAbsolute, inte procent.
 */

import type { MetricTrend, ReportMetrics, ReportSnapshot } from "./types.ts";

function trend(
  current: number | null | undefined,
  previous: number | null | undefined,
): MetricTrend {
  const cur = typeof current === "number" ? current : null;
  const prev = typeof previous === "number" ? previous : null;
  const deltaAbsolute = cur != null && prev != null ? cur - prev : null;
  const deltaPct =
    cur != null && prev != null && prev !== 0
      ? ((cur - prev) / prev) * 100
      : null;
  return { current: cur, previous: prev, deltaPct, deltaAbsolute };
}

function ctrOf(snap: ReportSnapshot | null | undefined): number | null {
  const sc = snap?.search_console;
  if (!sc || sc.impressions <= 0) return null;
  return typeof sc.ctr === "number"
    ? sc.ctr * 100
    : (sc.clicks / sc.impressions) * 100;
}

export function computeReportMetrics(
  latest: ReportSnapshot | null | undefined,
  previous: ReportSnapshot | null | undefined,
): ReportMetrics {
  const isFirstReport = !previous;

  const topQueries = (latest?.search_console?.top_queries ?? [])
    .slice(0, 5)
    .map((q) => ({
      query: q.query,
      clicks: q.clicks,
      position: Math.round(q.position * 10) / 10,
    }));
  const topPages = (latest?.search_console?.top_pages ?? []).slice(0, 10);
  const opportunities = (latest?.search_console?.opportunities ?? []).slice(
    0,
    20,
  );

  return {
    clicks: trend(
      latest?.search_console?.clicks,
      previous?.search_console?.clicks,
    ),
    impressions: trend(
      latest?.search_console?.impressions,
      previous?.search_console?.impressions,
    ),
    ctr: trend(ctrOf(latest), ctrOf(previous)),
    position: trend(
      latest?.search_console?.position,
      previous?.search_console?.position,
    ),
    performance_score: trend(
      latest?.performance_score,
      previous?.performance_score,
    ),
    lcp_ms: trend(latest?.pagespeed?.lcp_ms, previous?.pagespeed?.lcp_ms),
    field_lcp_ms: trend(
      latest?.field_data?.lcp_ms,
      previous?.field_data?.lcp_ms,
    ),
    field_inp_ms: trend(
      latest?.field_data?.inp_ms,
      previous?.field_data?.inp_ms,
    ),
    field_cls: trend(latest?.field_data?.cls, previous?.field_data?.cls),
    reviews_count: trend(
      latest?.business_profile?.reviews_count,
      previous?.business_profile?.reviews_count,
    ),
    topQueries,
    topPages,
    opportunities,
    isFirstReport,
  };
}
