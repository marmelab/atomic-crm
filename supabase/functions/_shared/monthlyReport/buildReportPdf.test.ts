import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildReportPdf } from "./buildReportPdf.ts";
import type { ReportViewModel } from "./types.ts";

const viewModel: ReportViewModel = {
  version: 2,
  companyName: "Östersunds Måleri AB",
  period: { start: "2026-05-01", end: "2026-05-31", label: "maj 2026" },
  comparisonPeriod: { start: "2026-04-01", end: "2026-04-30" },
  coverage: { available: 4, total: 4, ratio: 1, missingSources: [] },
  metrics: {
    clicks: { current: 50, previous: 40, deltaPct: 25, deltaAbsolute: 10 },
    impressions: {
      current: 1000,
      previous: 800,
      deltaPct: 25,
      deltaAbsolute: 200,
    },
    ctr: { current: 5, previous: 5, deltaPct: 0, deltaAbsolute: 0 },
    position: {
      current: 8,
      previous: 10,
      deltaPct: -20,
      deltaAbsolute: -2,
    },
    performance_score: {
      current: 82,
      previous: 75,
      deltaPct: 9.33,
      deltaAbsolute: 7,
    },
    lcp_ms: {
      current: 2200,
      previous: 2800,
      deltaPct: -21.4,
      deltaAbsolute: -600,
    },
    field_lcp_ms: {
      current: 2400,
      previous: 2800,
      deltaPct: -14.3,
      deltaAbsolute: -400,
    },
    field_inp_ms: {
      current: 160,
      previous: 220,
      deltaPct: -27.3,
      deltaAbsolute: -60,
    },
    field_cls: {
      current: 0.08,
      previous: 0.12,
      deltaPct: -33.3,
      deltaAbsolute: -0.04,
    },
    reviews_count: {
      current: 14,
      previous: 12,
      deltaPct: 16.7,
      deltaAbsolute: 2,
    },
    topQueries: [{ query: "målare östersund", clicks: 20, position: 4.2 }],
    topPages: [],
    opportunities: [
      {
        kind: "position_4_10",
        query: "fasadmålning jämtland",
        clicks: 4,
        impressions: 90,
        ctr: 0.044,
        position: 7.1,
      },
    ],
    isFirstReport: false,
  },
  statuses: {
    googleVisibility: "good",
    pageExperience: "good",
    localVisibility: "good",
    technicalFoundation: "needs_attention",
  },
  technicalChecks: [
    {
      key: "title",
      label: "Sidtitel",
      passed: true,
      explanation: "Beskriver sidan för sökmotorer.",
    },
    {
      key: "schema_org",
      label: "Strukturerad data",
      passed: false,
      explanation: "Hjälper Google förstå verksamheten.",
    },
  ],
  recommendations: [
    {
      key: "missing_schema_org",
      severity: "medium",
      title: "Saknar strukturerad data",
      description: "Google och AI får svårare att förstå erbjudandet.",
      service: "AI-sök-optimering",
    },
  ],
  primaryRecommendation: {
    key: "missing_schema_org",
    severity: "medium",
    title: "Saknar strukturerad data",
    description: "Google och AI får svårare att förstå erbjudandet.",
    service: "AI-sök-optimering",
  },
};

describe("buildReportPdf", () => {
  it("creates a readable multi-section PDF with Swedish characters", async () => {
    const bytes = await buildReportPdf({
      viewModel,
      aiContent: {
        greeting: "Hej Åsa,",
        summary: "Synligheten ökade och sidupplevelsen blev bättre.",
        recommended_action: "Lägg till strukturerad data för måleritjänsterna.",
        upsell_pitch: "Det gör erbjudandet tydligare för både Google och AI.",
      },
    });
    expect(bytes.byteLength).toBeGreaterThan(2_000);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(pdf.getTitle()).toContain("Östersunds Måleri");
  });
});
