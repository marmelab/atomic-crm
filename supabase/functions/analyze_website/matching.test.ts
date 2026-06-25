import { describe, expect, it } from "vitest";
import { domainOf, isPlaceMatch, selectVerifiedPlace } from "./matching.ts";

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

describe("isPlaceMatch — särskiljande del (facit från manuell verifiering)", () => {
  it("tillåter namnvariation via särskiljande ord (Sandgren)", () => {
    // CRM har legalt namn, Google handelsnamn — "sandgren" är gemensamt.
    expect(
      isPlaceMatch({
        companyName: "Christoffer Sandgren Bygg & Snickeri AB",
        placeName: "Sandgren Bygg & Snickeri",
      }),
    ).toBe(true);
  });

  it("avvisar annat företag som bara delar ett generiskt branschord (Furuhov)", () => {
    expect(
      isPlaceMatch({
        companyName: "Furuhov Hundpark",
        placeName: "Brunflo Hundpark",
      }),
    ).toBe(false);
    expect(
      isPlaceMatch({
        companyName: "Furuhov Hundpark",
        placeName: "Furuhov Hundpark",
      }),
    ).toBe(true);
  });

  it("kräver den särskiljande delen, inte bara bransch + ort (Isakssons)", () => {
    expect(
      isPlaceMatch({
        companyName: "Isakssons Måleri i Östersund AB",
        placeName: "Måleri i Östersund",
      }),
    ).toBe(false);
    expect(
      isPlaceMatch({
        companyName: "Isakssons Måleri i Östersund AB",
        placeName: "Isakssons Måleri",
      }),
    ).toBe(true);
  });

  it("kräver hela namnet vid kort akronym + branschord (JVS/MB/VPM)", () => {
    expect(
      isPlaceMatch({
        companyName: "JVS Maskiner AB",
        placeName: "Östersunds Maskiner AB",
      }),
    ).toBe(false);
    expect(
      isPlaceMatch({
        companyName: "JVS Maskiner AB",
        placeName: "JVS Maskiner",
      }),
    ).toBe(true);
    expect(
      isPlaceMatch({
        companyName: "MB Färg & Kakel AB",
        placeName: "Färg & Kakel i Östersund",
      }),
    ).toBe(false);
    expect(
      isPlaceMatch({
        companyName: "MB Färg & Kakel AB",
        placeName: "MB Färg & Kakel",
      }),
    ).toBe(true);
    expect(
      isPlaceMatch({
        companyName: "VPM Energi AB",
        placeName: "Jämtlands Energi AB",
      }),
    ).toBe(false);
  });

  it("avvisar annat företag som bara delar ortnamn (Rödöns)", () => {
    expect(
      isPlaceMatch({
        companyName: "Rödöns Bygg AB",
        placeName: "Rödöns Trä & Montage",
      }),
    ).toBe(false);
    expect(
      isPlaceMatch({ companyName: "Rödöns Bygg AB", placeName: "Rödöns Bygg" }),
    ).toBe(true);
  });

  it("matchar äkta helnamnsföretag men ej generisk ort-variant (Östersunds Elservice)", () => {
    expect(
      isPlaceMatch({
        companyName: "Östersunds Elservice AB",
        placeName: "Östersunds Elservice AB",
      }),
    ).toBe(true);
    expect(
      isPlaceMatch({
        companyName: "Östersunds Elservice AB",
        placeName: "Östersund El & Montage",
      }),
    ).toBe(false);
  });
});

describe("selectVerifiedPlace", () => {
  const swede = {
    id: "ChIJzdTArBOa14MRlgHJvPWn9o8",
    name: "Zontaxi Östersund",
    website: null,
    country: "SE",
    reviews_count: 31,
  };
  const dutch = {
    id: "ChIJo-c47Br2GWwRCsOaD72-pXo",
    name: "Zontaxi",
    website: null,
    country: "NL",
    reviews_count: 23,
  };

  it("rejects the foreign namesake and picks the Swedish business (the Zontaxi bug)", () => {
    // Holländska "Zontaxi" rankas först — landsfiltret måste hoppa över den.
    const match = selectVerifiedPlace({ name: "Zontaxi" }, [dutch, swede]);
    expect(match?.id).toBe(swede.id);
    expect(match?.reviews_count).toBe(31);
  });

  it("returns null when the only candidate is foreign", () => {
    expect(selectVerifiedPlace({ name: "Zontaxi" }, [dutch])).toBeNull();
  });

  it("accepts a candidate with unknown country when the name matches", () => {
    const match = selectVerifiedPlace({ name: "Zontaxi" }, [
      { id: "x", name: "Zontaxi Östersund", website: null, country: null },
    ]);
    expect(match?.id).toBe("x");
  });

  it("rejects a Swedish namesake with a contradicting website domain", () => {
    const match = selectVerifiedPlace(
      { name: "ARONSGÅRD Bygg", website: "https://aronsgard.se" },
      [
        {
          id: "y",
          name: "Aronsgård Bygg",
          website: "https://annandoman.se",
          country: "SE",
        },
      ],
    );
    expect(match).toBeNull();
  });

  it("returns null when no candidate matches the name", () => {
    const match = selectVerifiedPlace({ name: "Zontaxi" }, [
      { id: "z", name: "Persson Måleri", website: null, country: "SE" },
    ]);
    expect(match).toBeNull();
  });
});
