import { describe, expect, it } from "vitest";

import { toConfiguredValue, toIsoDate, toNumber, toText } from "./parseCell";

const stages = [
  { value: "opportunity", label: "Opportunity" },
  { value: "proposal-sent", label: "Proposal Sent" },
];

describe("toText", () => {
  it("trims the cell content", () => {
    expect(toText("  Acme  ")).toBe("Acme");
  });

  it("returns undefined for an empty or blank cell", () => {
    expect(toText(null)).toBeUndefined();
    expect(toText("")).toBeUndefined();
    expect(toText("   ")).toBeUndefined();
  });

  it("stringifies cells Papa Parse already converted", () => {
    expect(toText(10001)).toBe("10001");
  });
});

describe("toNumber", () => {
  it("converts a numeric cell", () => {
    expect(toNumber("12000")).toBe(12000);
    expect(toNumber(250)).toBe(250);
  });

  it("returns undefined for an empty or non-numeric cell", () => {
    expect(toNumber(null)).toBeUndefined();
    expect(toNumber("a lot")).toBeUndefined();
  });
});

describe("toIsoDate", () => {
  it("converts a date cell to an ISO string", () => {
    expect(toIsoDate("2026-09-30")).toBe("2026-09-30T00:00:00.000Z");
  });

  it("returns undefined for an empty or unparsable cell", () => {
    expect(toIsoDate(null)).toBeUndefined();
    expect(toIsoDate("next quarter")).toBeUndefined();
  });
});

describe("toConfiguredValue", () => {
  it("matches a configured value", () => {
    expect(toConfiguredValue("proposal-sent", stages)).toBe("proposal-sent");
  });

  it("matches a configured label, whatever its case", () => {
    expect(toConfiguredValue("Proposal Sent", stages)).toBe("proposal-sent");
    expect(toConfiguredValue("proposal sent", stages)).toBe("proposal-sent");
  });

  it("returns undefined when no option matches", () => {
    expect(toConfiguredValue("Archived", stages)).toBeUndefined();
    expect(toConfiguredValue(null, stages)).toBeUndefined();
  });
});
