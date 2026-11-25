import { isOfferedLocale, parseUserPreferences } from "./preferences";

describe("parseUserPreferences", () => {
  it("keeps valid values", () => {
    expect(parseUserPreferences({ theme: "dark", locale: "fr" })).toEqual({
      theme: "dark",
      locale: "fr",
    });
    expect(parseUserPreferences({ locale: "en-GB" })).toEqual({
      locale: "en-GB",
    });
  });

  it("drops a theme that would break classList.add", () => {
    expect(parseUserPreferences({ theme: "a b" })).toEqual({});
    expect(parseUserPreferences({ theme: "" })).toEqual({});
    expect(parseUserPreferences({ theme: {} })).toEqual({});
    expect(parseUserPreferences({ theme: "purple" })).toEqual({});
  });

  it("drops one malformed field without discarding its valid sibling", () => {
    expect(parseUserPreferences({ theme: "a b", locale: "fr" })).toEqual({
      locale: "fr",
    });
    expect(parseUserPreferences({ theme: "dark", locale: 42 })).toEqual({
      theme: "dark",
    });
  });

  it("strips unknown keys", () => {
    expect(
      parseUserPreferences({ theme: "light", sneaky: "<script>" }),
    ).toEqual({ theme: "light" });
  });

  it("accepts the BCP-47 tags a fork may configure", () => {
    for (const locale of ["en", "fr", "en-GB", "zh-Hans", "fil", "pt-BR"]) {
      expect(parseUserPreferences({ locale })).toEqual({ locale });
    }
  });

  it("returns an empty object for anything that is not an object", () => {
    expect(parseUserPreferences(null)).toEqual({});
    expect(parseUserPreferences(undefined)).toEqual({});
    expect(parseUserPreferences("dark")).toEqual({});
    expect(parseUserPreferences(7)).toEqual({});
  });
});

describe("isOfferedLocale", () => {
  const offered = [{ locale: "en" }, { locale: "fr" }];

  it("accepts a locale the app offers", () => {
    expect(isOfferedLocale("fr", offered)).toBe(true);
  });

  it("rejects a locale the app does not offer", () => {
    expect(isOfferedLocale("de", offered)).toBe(false);
  });

  it("rejects a missing locale", () => {
    expect(isOfferedLocale(undefined, offered)).toBe(false);
  });

  it("accepts anything when the provider declares no locales", () => {
    expect(isOfferedLocale("de", [])).toBe(true);
  });
});
