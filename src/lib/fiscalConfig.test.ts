import { describe, expect, it } from "vitest";

import {
  getFirstValidFiscalTaxProfileAtecoCode,
  getFiscalFallbackProfileStatus,
  isValidFiscalTaxProfileAtecoCode,
} from "./fiscalConfig";

describe("fiscalConfig helpers", () => {
  it("picks the first valid profile code from the configured list", () => {
    expect(
      getFirstValidFiscalTaxProfileAtecoCode([
        {
          atecoCode: "",
          description: "Empty",
          coefficienteReddititivita: 78,
          linkedCategories: [],
        },
        {
          atecoCode: "621000",
          description: "IT",
          coefficienteReddititivita: 67,
          linkedCategories: ["sviluppo_web"],
        },
      ]),
    ).toBe("621000");
  });

  it("marks a selected fallback as invalid when no matching profile exists", () => {
    expect(
      isValidFiscalTaxProfileAtecoCode("731102", [
        {
          atecoCode: "621000",
          description: "IT",
          coefficienteReddititivita: 67,
          linkedCategories: ["sviluppo_web"],
        },
      ]),
    ).toBe(false);
  });

  it("returns a blocking status when no valid fiscal profile remains", () => {
    const status = getFiscalFallbackProfileStatus({
      taxProfiles: [],
      defaultTaxProfileAtecoCode: "731102",
    });

    expect(status.isValid).toBe(false);
    expect(status.firstValidCode).toBeNull();
    expect(status.blockingMessage).toContain("almeno un profilo ATECO valido");
  });
});
