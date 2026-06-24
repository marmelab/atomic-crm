import { describe, expect, it } from "vitest";

import type {
  CustomerVisibilityDashboardResponse,
  WebsiteSnapshot,
} from "../types";
import {
  buildCustomerPortfolioViewModel,
  previousCompleteMonth,
} from "./portfolioModel";

function snapshot(
  overrides: Partial<WebsiteSnapshot> = {},
): WebsiteSnapshot {
  return {
    id: 1,
    company_id: 1,
    fetched_at: "2026-06-04T06:00:00Z",
    source: "cron",
    url: "https://example.se",
    period_start: "2026-05-01",
    period_end: "2026-05-31",
    window_kind: "calendar_month",
    data_coverage: { available_sources: 4, total_sources: 4, ratio: 1 },
    source_status: {
      pagespeed: { status: "available" },
      seo_crawl: { status: "available" },
      business_profile: { status: "available" },
      search_console: { status: "available" },
    },
    performance_score: 92,
    field_data: {
      scope: "origin",
      lcp_rating: "GOOD",
      inp_rating: "GOOD",
      cls_rating: "GOOD",
    },
    seo_checks: {
      indexable: true,
      title: "Titel",
      meta_description: "Beskrivning",
      h1: true,
      sitemap: true,
      robots: true,
      schema_org: true,
      og_tags: true,
    },
    business_profile: { found: true, rating: 4.8, reviews_count: 20 },
    search_console: {
      clicks: 120,
      impressions: 1000,
      ctr: 0.12,
      position: 4,
      top_queries: [],
    },
    findings: [],
    created_at: "2026-06-04T06:00:00Z",
    ...overrides,
  };
}

function response(
  current: WebsiteSnapshot | null,
  previous: WebsiteSnapshot | null,
): CustomerVisibilityDashboardResponse {
  return {
    period: { start: "2026-05-01", end: "2026-05-31" },
    previous_period: { start: "2026-04-01", end: "2026-04-30" },
    rows: [
      {
        company_id: 1,
        company_name: "Exempel AB",
        delivered_website_url: "https://example.se",
        current_snapshot: current,
        previous_snapshot: previous,
        latest_analysis: current,
        report: null,
        history: current ? [current] : [],
      },
    ],
  };
}

describe("customer portfolio model", () => {
  it("classifies strong measured growth as very good", () => {
    const model = buildCustomerPortfolioViewModel(
      response(snapshot(), snapshot({ search_console: {
        clicks: 80,
        impressions: 900,
        ctr: 80 / 900,
        position: 5,
        top_queries: [],
      } })),
    );
    expect(model.rows[0].category).toBe("very_good");
  });

  it("classifies critical technical findings as poor", () => {
    const model = buildCustomerPortfolioViewModel(
      response(
        snapshot({
          findings: [
            {
              key: "noindex",
              severity: "high",
              title: "Webbplatsen är inte indexerbar",
              description: "Google kan inte läsa sidan.",
              service: "Teknisk SEO",
            },
          ],
        }),
        null,
      ),
    );
    expect(model.rows[0].category).toBe("poor");
  });

  it("does not treat missing data as zero or healthy", () => {
    const model = buildCustomerPortfolioViewModel(response(null, null));
    expect(model.rows[0].category).toBe("missing");
    expect(model.metrics.clicks).toBeNull();
    expect(model.metrics.searchCustomers).toBe(0);
  });

  it("weights portfolio position by impressions", () => {
    const second = snapshot({
      id: 2,
      company_id: 2,
      search_console: {
        clicks: 10,
        impressions: 100,
        ctr: 0.1,
        position: 20,
        top_queries: [],
      },
    });
    const data = response(snapshot(), null);
    data.rows.push({
      company_id: 2,
      company_name: "Andra AB",
      delivered_website_url: "https://andra.se",
      current_snapshot: second,
      previous_snapshot: null,
      latest_analysis: second,
      report: null,
      history: [second],
    });
    const model = buildCustomerPortfolioViewModel(data);
    expect(model.metrics.position).toBeCloseTo((4 * 1000 + 20 * 100) / 1100);
  });

  it("selects the previous complete calendar month over year boundaries", () => {
    expect(previousCompleteMonth(new Date("2026-01-15T12:00:00Z"))).toBe(
      "2025-12-01",
    );
  });

  it("uses Lighthouse and technical data when Search Console is missing", () => {
    const lighthouseOnly = snapshot({
      window_kind: "rolling_28d",
      search_console: null,
      source_status: {
        pagespeed: { status: "available" },
        seo_crawl: { status: "available" },
        business_profile: { status: "available" },
        search_console: { status: "unavailable" },
      },
      data_coverage: {
        available_sources: 3,
        total_sources: 4,
        ratio: 0.75,
      },
    });
    const data = response(null, null);
    data.rows[0].latest_analysis = lighthouseOnly;
    const model = buildCustomerPortfolioViewModel(data);

    expect(model.rows[0].category).toBe("good");
    expect(model.rows[0].dataBasis).toBe("latest_analysis");
    expect(model.rows[0].currentSnapshot?.performance_score).toBe(92);
    expect(model.rows[0].reasons.map((reason) => reason.label)).toContain(
      "Search Console saknas – övrig analys finns",
    );
  });

  it("combines official Search Console with the latest Lighthouse analysis", () => {
    const official = snapshot({
      id: 10,
      performance_score: null,
      pagespeed: null,
      field_data: null,
      seo_checks: null,
      business_profile: null,
      findings: [],
      data_coverage: {
        available_sources: 1,
        total_sources: 4,
        ratio: 0.25,
        backfilled: true,
      },
    });
    const analysis = snapshot({
      id: 11,
      window_kind: "rolling_28d",
      search_console: null,
      performance_score: 76,
    });
    const data = response(official, null);
    data.rows[0].latest_analysis = analysis;
    const model = buildCustomerPortfolioViewModel(data);

    expect(model.rows[0].dataBasis).toBe("combined");
    expect(model.rows[0].currentSnapshot?.search_console?.clicks).toBe(120);
    expect(model.rows[0].currentSnapshot?.performance_score).toBe(76);
    expect(model.rows[0].viewModel?.coverage.available).toBe(4);
  });

  it("puts the category-triggering problem before positive click growth", () => {
    const current = snapshot({
      findings: [
        {
          key: "missing_schema",
          severity: "medium",
          title: "Strukturerad data saknas",
          description: "Sidan är svårare att tolka.",
          service: "Teknisk SEO",
        },
      ],
    });
    const previous = snapshot({
      search_console: {
        clicks: 70,
        impressions: 800,
        ctr: 0.0875,
        position: 5,
        top_queries: [],
      },
    });
    const model = buildCustomerPortfolioViewModel(
      response(current, previous),
    );

    expect(model.rows[0].category).toBe("watch");
    expect(model.rows[0].reasons[0].label).toBe("Strukturerad data saknas");
    expect(model.rows[0].reasons[1].label).toContain("fler Google-klick");
  });
});
