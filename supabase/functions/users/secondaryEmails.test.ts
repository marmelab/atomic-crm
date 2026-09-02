// @vitest-environment node
import { describe, it, expect } from "vitest";
import { findInvalidEmail, normalizeSecondaryEmails } from "./secondaryEmails";

describe("normalizeSecondaryEmails", () => {
  it("returns undefined for a non-array, so the caller rejects instead of wiping", () => {
    expect(normalizeSecondaryEmails(undefined)).toBe(undefined);
    expect(normalizeSecondaryEmails(null)).toBe(undefined);
    expect(normalizeSecondaryEmails("john@perso.com")).toBe(undefined);
    expect(normalizeSecondaryEmails({ 0: "john@perso.com" })).toBe(undefined);
  });

  it("returns an empty array for an empty array, which clears the addresses", () => {
    expect(normalizeSecondaryEmails([])).toEqual([]);
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

describe("findInvalidEmail", () => {
  it("returns undefined when every address is well formed", () => {
    expect(
      findInvalidEmail(["john@perso.com", "j.doe+tag@sub.domain.co.uk"]),
    ).toBe(undefined);
  });

  it("returns undefined for an empty list", () => {
    expect(findInvalidEmail([])).toBe(undefined);
  });

  it("reports an address with no domain", () => {
    expect(findInvalidEmail(["john@perso.com", "not-an-email"])).toBe(
      "not-an-email",
    );
  });

  it("reports an address with no top level domain", () => {
    expect(findInvalidEmail(["john@localhost"])).toBe("john@localhost");
  });

  it("reports an address containing a space", () => {
    expect(findInvalidEmail(["john doe@perso.com"])).toBe("john doe@perso.com");
  });

  it("reports the first offending address so the caller can name it", () => {
    expect(findInvalidEmail(["bad-one", "bad-two"])).toBe("bad-one");
  });

  it("rejects a comma, which would split the PostgREST or() filter", () => {
    expect(findInvalidEmail(["john,doe@perso.com"])).toBe("john,doe@perso.com");
  });
});
