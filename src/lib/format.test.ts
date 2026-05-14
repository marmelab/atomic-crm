import { describe, expect, it } from "vitest";
import { formatSZL } from "./format";

describe("formatSZL", () => {
  it("formats a whole number with E prefix, commas, and 2 decimals", () => {
    expect(formatSZL(5000)).toBe("E5,000.00");
  });

  it("formats a decimal amount", () => {
    expect(formatSZL(1234.56)).toBe("E1,234.56");
  });

  it("formats zero", () => {
    expect(formatSZL(0)).toBe("E0.00");
  });

  it("formats a large amount with multiple comma groups", () => {
    expect(formatSZL(1000000)).toBe("E1,000,000.00");
  });

  it("formats a small sub-one amount", () => {
    expect(formatSZL(0.5)).toBe("E0.50");
  });
});
