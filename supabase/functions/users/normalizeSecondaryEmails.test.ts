// @vitest-environment node
import { describe, it, expect } from "vitest";
import { normalizeSecondaryEmails } from "./normalizeSecondaryEmails";

describe("normalizeSecondaryEmails", () => {
  it("returns an empty array when the value is not an array", () => {
    expect(normalizeSecondaryEmails(undefined)).toEqual([]);
    expect(normalizeSecondaryEmails(null)).toEqual([]);
    expect(normalizeSecondaryEmails("john@perso.com")).toEqual([]);
  });

  it("trims and lowercases every address", () => {
    expect(normalizeSecondaryEmails(["  John@Perso.COM  "])).toEqual([
      "john@perso.com",
    ]);
  });

  it("removes addresses that differ only by case or spacing", () => {
    expect(
      normalizeSecondaryEmails(["john@perso.com", " JOHN@perso.com "]),
    ).toEqual(["john@perso.com"]);
  });

  it("drops empty entries and non-string values", () => {
    expect(
      normalizeSecondaryEmails(["john@perso.com", "", "   ", 42, null]),
    ).toEqual(["john@perso.com"]);
  });

  it("preserves the order of the remaining addresses", () => {
    expect(
      normalizeSecondaryEmails(["b@perso.com", "a@perso.com", "c@perso.com"]),
    ).toEqual(["b@perso.com", "a@perso.com", "c@perso.com"]);
  });
});
