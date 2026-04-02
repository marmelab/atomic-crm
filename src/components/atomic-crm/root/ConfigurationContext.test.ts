import { describe, expect, it } from "vitest";

import { mergeConfigurationWithDefaults } from "./ConfigurationContext";
import { defaultConfiguration } from "./defaultConfiguration";

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

  it("derives the fallback ATECO code from the first persisted profile when older config lacks the new field", () => {
    const merged = mergeConfigurationWithDefaults({
      fiscalConfig: {
        taxProfiles: [
          {
            atecoCode: "621000",
            description: "IT",
            coefficienteReddititivita: 67,
            linkedCategories: ["sviluppo_web"],
          },
          {
            atecoCode: "731102",
            description: "Marketing",
            coefficienteReddititivita: 78,
            linkedCategories: ["produzione_tv"],
          },
        ],
      },
    });

    expect(merged.fiscalConfig?.defaultTaxProfileAtecoCode).toBe("621000");
  });

  it("keeps the explicit fallback ATECO code when persisted config already has it", () => {
    const merged = mergeConfigurationWithDefaults({
      fiscalConfig: {
        taxProfiles: [
          {
            atecoCode: "621000",
            description: "IT",
            coefficienteReddititivita: 67,
            linkedCategories: ["sviluppo_web"],
          },
          {
            atecoCode: "731102",
            description: "Marketing",
            coefficienteReddititivita: 78,
            linkedCategories: ["produzione_tv"],
          },
        ],
        defaultTaxProfileAtecoCode: "731102",
      },
    });

    expect(merged.fiscalConfig?.defaultTaxProfileAtecoCode).toBe("731102");
  });

  it("keeps a stable fallback ATECO code when older persisted config has no fiscal section at all", () => {
    const merged = mergeConfigurationWithDefaults({});

    expect(merged.fiscalConfig?.defaultTaxProfileAtecoCode).toBe(
      defaultConfiguration.fiscalConfig.defaultTaxProfileAtecoCode,
    );
  });
});
