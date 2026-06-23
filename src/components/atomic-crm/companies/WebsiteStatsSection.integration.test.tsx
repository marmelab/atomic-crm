import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import {
  createCrmDb,
  createCrmScenario,
  CrmTestProvider,
} from "@/test/browser/atomic-crm/crmUiHarness";
import type { Company, MonthlyReport, WebsiteSnapshot } from "../types";
import { WebsiteStatsSection } from "./WebsiteStatsSection";

const company = {
  id: 7,
  name: "Östersunds Måleri AB",
} as Company;

const snapshot = {
  id: 10,
  company_id: 7,
  fetched_at: "2026-06-04T06:30:00Z",
  source: "cron",
  url: "https://example.com",
  period_start: "2026-05-01",
  period_end: "2026-05-31",
  window_kind: "calendar_month",
  data_coverage: {
    available_sources: 4,
    total_sources: 4,
    ratio: 1,
    has_search_console: true,
    has_field_data: true,
  },
  source_status: {
    pagespeed: { status: "available" },
    seo_crawl: { status: "available" },
    business_profile: { status: "available" },
    search_console: { status: "available" },
  },
  performance_score: 82,
  pagespeed: { lcp_ms: 2100, cls: 0.04, tbt_ms: 80 },
  field_data: {
    scope: "origin",
    lcp_ms: 2400,
    inp_ms: 170,
    cls: 0.08,
    lcp_rating: "GOOD",
    inp_rating: "GOOD",
    cls_rating: "GOOD",
  },
  seo_checks: {
    title: "Målare i Östersund",
    meta_description: "Professionellt måleri.",
    h1: true,
    sitemap: true,
    robots: true,
    schema_org: false,
    og_tags: true,
  },
  business_profile: { found: true, rating: 4.8, reviews_count: 18 },
  search_console: {
    clicks: 50,
    impressions: 1000,
    ctr: 0.05,
    position: 8,
    top_queries: [
      {
        query: "målare östersund",
        clicks: 20,
        impressions: 200,
        ctr: 0.1,
        position: 3.2,
      },
    ],
    top_pages: [
      {
        page: "https://example.com/malare",
        clicks: 30,
        impressions: 500,
        ctr: 0.06,
        position: 5,
      },
    ],
    opportunities: [
      {
        kind: "position_11_20",
        query: "fasadmålning jämtland",
        clicks: 2,
        impressions: 80,
        ctr: 0.025,
        position: 12,
      },
    ],
  },
  findings: [
    {
      key: "missing_schema_org",
      severity: "medium",
      title: "Saknar strukturerad data",
      description: "Google och AI får svårare att förstå verksamheten.",
      service: "AI-sök-optimering",
    },
  ],
  created_at: "2026-06-04T06:30:00Z",
} satisfies WebsiteSnapshot;

describe("WebsiteStatsSection integration", () => {
  it("renders the pedagogical overview and search opportunities", async () => {
    const scenario = createCrmScenario({
      db: createCrmDb({
        website_snapshots: [snapshot],
        monthly_reports: [] as MonthlyReport[],
      } as never),
    });

    const screen = await render(
      <CrmTestProvider scenario={scenario}>
        <WebsiteStatsSection company={company} />
      </CrmTestProvider>,
    );

    await expect.element(screen.getByText("Samlad synlighetsvy")).toBeVisible();
    await expect
      .element(screen.getByText("Viktigaste nästa steg"))
      .toBeVisible();
    await expect
      .element(screen.getByText("Saknar strukturerad data", { exact: true }))
      .toBeVisible();

    await screen.getByRole("tab", { name: "Google & sökord" }).click();
    await expect.element(screen.getByText("Klick från Google")).toBeVisible();
    await expect
      .element(screen.getByText("fasadmålning jämtland"))
      .toBeVisible();
  });
});
