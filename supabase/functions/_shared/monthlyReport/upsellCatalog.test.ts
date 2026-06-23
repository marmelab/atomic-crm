import { describe, expect, it } from "vitest";
import { DEFAULT_UPSELL_CATALOG, selectUpsells } from "./upsellCatalog.ts";
import type { ReportFinding } from "./types.ts";

const finding = (
  key: string,
  severity: ReportFinding["severity"],
  service: string,
): ReportFinding => ({
  key,
  severity,
  service,
  title: key,
  description: key,
});

describe("selectUpsells", () => {
  it("returns empty when no findings", () => {
    expect(selectUpsells([])).toEqual([]);
    expect(selectUpsells(null)).toEqual([]);
  });

  it("maps a finding's service to the catalog offer", () => {
    const result = selectUpsells([
      finding("missing_business_profile", "high", "Google Business-paket"),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].service).toBe("Google Business-paket");
  });

  it("orders by highest severity first across services", () => {
    const result = selectUpsells([
      finding("missing_og_tags", "low", "Innehåll & synlighet"),
      finding("missing_business_profile", "high", "Google Business-paket"),
    ]);
    expect(result[0].service).toBe("Google Business-paket"); // high before low
    expect(result[1].service).toBe("Innehåll & synlighet");
  });

  it("dedupes multiple findings of the same service", () => {
    const result = selectUpsells([
      finding("no_clicks", "high", "SEO-optimering"),
      finding("low_position", "medium", "SEO-optimering"),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].service).toBe("SEO-optimering");
  });

  it("respects hiddenKeys (llms.txt never drives a customer upsell)", () => {
    const result = selectUpsells(
      [finding("missing_llms_txt", "low", "AI-sök-optimering")],
      DEFAULT_UPSELL_CATALOG,
      ["missing_llms_txt"],
    );
    expect(result).toEqual([]);
  });

  it("ignores findings whose service is not in the catalog", () => {
    const result = selectUpsells([finding("x", "high", "Okänd tjänst")]);
    expect(result).toEqual([]);
  });
});
