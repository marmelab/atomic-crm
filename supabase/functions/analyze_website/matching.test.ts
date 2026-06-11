import { describe, expect, it } from "vitest";
import { domainOf, isPlaceMatch } from "./matching.ts";

describe("domainOf", () => {
  it("normalizes urls with and without protocol", () => {
    expect(domainOf("https://www.danielssonsbygg.se/")).toBe(
      "danielssonsbygg.se",
    );
    expect(domainOf("danielssonsbygg.se")).toBe("danielssonsbygg.se");
    expect(domainOf(null)).toBeNull();
    expect(domainOf("not a url at all :::")).toBeNull();
  });
});

describe("isPlaceMatch", () => {
  it("matches on identical website domains regardless of name", () => {
    expect(
      isPlaceMatch({
        companyName: "danielssonsbygg vemdalen",
        companyWebsite: "https://danielssonsbygg.se",
        placeName: "Danielssons Bygg & Snickeri",
        placeWebsite: "http://www.danielssonsbygg.se/kontakt",
      }),
    ).toBe(true);
  });

  it("rejects another business in the same town (the danielssonsbygg bug)", () => {
    expect(
      isPlaceMatch({
        companyName: "danielssonsbygg vemdalen",
        companyWebsite: null,
        placeName: "Vemdalens Fjällhotell",
        placeWebsite: "https://vemdalensfjallhotell.se",
      }),
    ).toBe(false);
  });

  it("matches compact name against spaced place name", () => {
    expect(
      isPlaceMatch({
        companyName: "danielssonsbygg vemdalen",
        companyWebsite: null,
        placeName: "Danielssons Bygg",
        placeWebsite: null,
      }),
    ).toBe(true);
  });

  it("matches via distinctive token for AB-suffixed names", () => {
    expect(
      isPlaceMatch({
        companyName: "ES Byggmontage AB",
        companyWebsite: null,
        placeName: "Byggmontage i Östersund",
        placeWebsite: null,
      }),
    ).toBe(true);
  });

  it("rejects when neither domain nor name overlaps", () => {
    expect(
      isPlaceMatch({
        companyName: "ARONSGÅRD Bygg & Service",
        companyWebsite: "https://aronsgard.se",
        placeName: "Persson Måleri",
        placeWebsite: "https://perssonmaleri.se",
      }),
    ).toBe(false);
  });

  it("rejects when place name is missing", () => {
    expect(
      isPlaceMatch({
        companyName: "Testbolaget AB",
        companyWebsite: null,
        placeName: null,
        placeWebsite: null,
      }),
    ).toBe(false);
  });
});
