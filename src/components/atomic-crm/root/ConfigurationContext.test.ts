import { describe, expect, it } from "vitest";

import { mergeConfigurationWithDefaults } from "./ConfigurationContext";

describe("mergeConfigurationWithDefaults", () => {
  it("keeps new nested AI defaults when persisted config is older", () => {
    const merged = mergeConfigurationWithDefaults({
      aiConfig: {
        historicalAnalysisModel: "gpt-5-mini",
      },
    });

    expect(merged.aiConfig?.historicalAnalysisModel).toBe("gpt-5-mini");
    expect(merged.aiConfig?.invoiceExtractionModel).toBe("gemini-2.5-pro");
  });

  it("merges taxability defaults with fiscal defaults", () => {
    const merged = mergeConfigurationWithDefaults({
      fiscalConfig: {
        taxabilityDefaults: {
          nonTaxableCategories: ["sviluppo_web"],
        },
      },
    });

    expect(
      merged.fiscalConfig?.taxabilityDefaults?.nonTaxableCategories,
    ).toEqual(["sviluppo_web"]);
    expect(
      merged.fiscalConfig?.taxabilityDefaults?.nonTaxableClientIds,
    ).toEqual([]);
  });

  it("supports empty non-taxable category defaults", () => {
    const merged = mergeConfigurationWithDefaults({
      fiscalConfig: {
        taxabilityDefaults: {
          nonTaxableCategories: [],
        },
      },
    });

    expect(
      merged.fiscalConfig?.taxabilityDefaults?.nonTaxableCategories,
    ).toEqual([]);
    expect(
      merged.fiscalConfig?.taxabilityDefaults?.nonTaxableClientIds,
    ).toEqual([]);
  });
});
