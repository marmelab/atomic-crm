import { describe, expect, it } from "vitest";
import type { AnalysisInput } from "./findings.ts";
import { computeFindings } from "./findings.ts";

const healthySite: AnalysisInput = {
  pagespeed: {
    performance_score: 95,
    seo_score: 100,
    lcp_ms: 1200,
    cls: 0.01,
    tbt_ms: 50,
    opportunities: [],
  },
  seoChecks: {
    title: "Testbolaget — Bygg i Östersund",
    meta_description: "Vi bygger hus.",
    og_tags: true,
    schema_org: true,
    sitemap: true,
    robots: true,
    llms_txt: true,
    h1: true,
  },
  businessProfile: { found: true, rating: 4.8, reviews_count: 27 },
  searchConsole: {
    clicks: 120,
    impressions: 2400,
    position: 4.2,
    top_queries: [],
  },
};

describe("computeFindings", () => {
  it("returns no findings for a healthy site", () => {
    expect(computeFindings(healthySite)).toEqual([]);
  });

  it("flags a slow site as high severity with LCP in the description", () => {
    const findings = computeFindings({
      ...healthySite,
      pagespeed: {
        ...healthySite.pagespeed!,
        performance_score: 32,
        lcp_ms: 6200,
      },
    });
    const slow = findings.find((f) => f.key === "slow_site");
    expect(slow?.severity).toBe("high");
    expect(slow?.description).toContain("6,2 s");
    expect(slow?.service).toBe("Prestandaoptimering");
  });

  it("flags missing Google Business profile as high severity", () => {
    const findings = computeFindings({
      ...healthySite,
      businessProfile: { found: false },
    });
    const missing = findings.find((f) => f.key === "missing_business_profile");
    expect(missing?.severity).toBe("high");
    expect(missing?.service).toBe("Google Business-paket");
  });

  it("flags missing schema.org and llms.txt as AI-search opportunities", () => {
    const findings = computeFindings({
      ...healthySite,
      seoChecks: {
        ...healthySite.seoChecks!,
        schema_org: false,
        llms_txt: false,
      },
    });
    expect(findings.map((f) => f.key)).toEqual(
      expect.arrayContaining(["missing_schema_org", "missing_llms_txt"]),
    );
    expect(
      findings
        .filter((f) =>
          ["missing_schema_org", "missing_llms_txt"].includes(f.key),
        )
        .every((f) => f.service === "AI-sök-optimering"),
    ).toBe(true);
  });

  it("skips entire sections when source data is null (failed fetch or no access)", () => {
    const findings = computeFindings({
      pagespeed: null,
      seoChecks: null,
      businessProfile: null,
      searchConsole: null,
    });
    expect(findings).toEqual([]);
  });

  it("flags zero clicks despite impressions from Search Console", () => {
    const findings = computeFindings({
      ...healthySite,
      searchConsole: {
        clicks: 0,
        impressions: 1500,
        position: 18,
        top_queries: [],
      },
    });
    const noClicks = findings.find((f) => f.key === "no_clicks");
    expect(noClicks?.severity).toBe("high");
    // no_clicks tar prio — low_position ska inte dubbelrapporteras
    expect(findings.find((f) => f.key === "low_position")).toBeUndefined();
  });

  it("flags few reviews on an existing business profile", () => {
    const findings = computeFindings({
      ...healthySite,
      businessProfile: { found: true, rating: 4.9, reviews_count: 2 },
    });
    expect(findings.find((f) => f.key === "few_reviews")?.title).toContain(
      "2 st",
    );
  });

  it("sorts findings by severity (high first)", () => {
    const findings = computeFindings({
      ...healthySite,
      pagespeed: { ...healthySite.pagespeed!, performance_score: 30 },
      seoChecks: { ...healthySite.seoChecks!, og_tags: false },
    });
    expect(findings[0].severity).toBe("high");
    expect(findings[findings.length - 1].severity).toBe("low");
  });
});
