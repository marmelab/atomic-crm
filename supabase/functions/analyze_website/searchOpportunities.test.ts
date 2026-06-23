import { describe, expect, it } from "vitest";
import { classifySearchOpportunities } from "./searchOpportunities.ts";

describe("classifySearchOpportunities", () => {
  it("finds queries already on positions 4–10", () => {
    const result = classifySearchOpportunities([
      {
        query: "målare östersund",
        clicks: 8,
        impressions: 100,
        ctr: 0.08,
        position: 7,
      },
    ]);
    expect(result.map((item) => item.kind)).toContain("position_4_10");
  });

  it("finds queries close to page one on positions 11–20", () => {
    const result = classifySearchOpportunities([
      {
        query: "fasadmålning jämtland",
        clicks: 2,
        impressions: 80,
        ctr: 0.025,
        position: 12,
      },
    ]);
    expect(result.map((item) => item.kind)).toContain("position_11_20");
  });

  it("finds high-impression queries with CTR below two percent", () => {
    const result = classifySearchOpportunities([
      {
        query: "målerifirma",
        clicks: 1,
        impressions: 100,
        ctr: 0.01,
        position: 6,
      },
    ]);
    expect(result.map((item) => item.kind)).toEqual(
      expect.arrayContaining(["position_4_10", "low_ctr"]),
    );
  });

  it("ignores statistically tiny query rows", () => {
    const result = classifySearchOpportunities([
      {
        query: "ovanlig sökning",
        clicks: 0,
        impressions: 4,
        ctr: 0,
        position: 15,
      },
    ]);
    expect(result).toEqual([]);
  });
});
