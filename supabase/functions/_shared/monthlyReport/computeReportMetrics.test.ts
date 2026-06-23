import { describe, expect, it } from "vitest";
import { computeReportMetrics } from "./computeReportMetrics.ts";
import type { ReportSnapshot } from "./types.ts";

const latest: ReportSnapshot = {
  performance_score: 81,
  pagespeed: { lcp_ms: 3500, cls: 0 },
  business_profile: { found: true, rating: 4.5, reviews_count: 12 },
  search_console: {
    clicks: 23,
    impressions: 121,
    position: 6.8,
    top_queries: [
      { query: "jvs maskiner ab", clicks: 10, impressions: 40, position: 1.2 },
      {
        query: "entreprenadmaskiner",
        clicks: 5,
        impressions: 30,
        position: 8.1,
      },
    ],
  },
};

const previous: ReportSnapshot = {
  performance_score: 67,
  pagespeed: { lcp_ms: 5100, cls: 0 },
  business_profile: { found: true, rating: 4.5, reviews_count: 10 },
  search_console: {
    clicks: 20,
    impressions: 100,
    position: 8.0,
    top_queries: [],
  },
};

describe("computeReportMetrics", () => {
  it("computes click trend with percentage delta", () => {
    const m = computeReportMetrics(latest, previous);
    expect(m.clicks.current).toBe(23);
    expect(m.clicks.previous).toBe(20);
    expect(m.clicks.deltaPct).toBeCloseTo(15, 5);
    expect(m.isFirstReport).toBe(false);
  });

  it("computes CTR from clicks/impressions", () => {
    const m = computeReportMetrics(latest, previous);
    // 23/121*100 ≈ 19.0
    expect(m.ctr.current).toBeCloseTo(19.008, 2);
    expect(m.ctr.previous).toBe(20); // 20/100*100
  });

  it("uses deltaAbsolute for position (lower is better)", () => {
    const m = computeReportMetrics(latest, previous);
    expect(m.position.current).toBe(6.8);
    expect(m.position.deltaAbsolute).toBeCloseTo(-1.2, 5);
  });

  it("limits top queries to 5 and rounds position", () => {
    const m = computeReportMetrics(latest, previous);
    expect(m.topQueries).toHaveLength(2);
    expect(m.topQueries[0]).toEqual({
      query: "jvs maskiner ab",
      clicks: 10,
      position: 1.2,
    });
  });

  it("flags first report when no previous snapshot", () => {
    const m = computeReportMetrics(latest, null);
    expect(m.isFirstReport).toBe(true);
    expect(m.clicks.deltaPct).toBeNull();
    expect(m.clicks.previous).toBeNull();
    expect(m.clicks.current).toBe(23);
  });

  it("returns null trend when search_console missing", () => {
    const m = computeReportMetrics({ performance_score: 90 }, null);
    expect(m.clicks.current).toBeNull();
    expect(m.ctr.current).toBeNull();
    expect(m.performance_score.current).toBe(90);
  });
});
