import { formatPrice, getProductTypeLabel } from "./productUtils";

// Normalize various space characters used by French locale (NNBSP, NBSP, etc.) to regular space
const normalize = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");

describe("formatPrice", () => {
  it("returns '—' for null", () => {
    expect(formatPrice(null)).toBe("—");
  });

  it("formats 150000 centimes as '1 500,00 €'", () => {
    expect(normalize(formatPrice(150000))).toBe("1 500,00 €");
  });

  it("formats 0 centimes as '0,00 €'", () => {
    expect(normalize(formatPrice(0))).toBe("0,00 €");
  });
});

describe("getProductTypeLabel", () => {
  it("returns human-readable label for 'robot'", () => {
    expect(getProductTypeLabel("robot")).toBe("Robot tondeuse");
  });

  it("returns the raw value for unknown types", () => {
    expect(getProductTypeLabel("unknown-type")).toBe("unknown-type");
  });
});
