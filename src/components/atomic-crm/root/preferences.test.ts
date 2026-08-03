import { parseUserPreferences } from "./preferences";

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

  it("returns an empty object for anything that is not an object", () => {
    expect(parseUserPreferences(null)).toEqual({});
    expect(parseUserPreferences(undefined)).toEqual({});
    expect(parseUserPreferences("dark")).toEqual({});
    expect(parseUserPreferences(7)).toEqual({});
  });
});
