import { describe, expect, it } from "vitest";
import {
  brandTokens,
  classifyBrandedQueries,
  isBranded,
} from "./brandedQueries.ts";

describe("brandTokens", () => {
  it("plockar särskiljande namn-token och domän-etikett, filtrerar bolagsord", () => {
    const tokens = brandTokens(
      "Östersunds Måleri AB",
      "https://ostersundsmaleri.se",
    );
    expect(tokens).toContain("ostersunds");
    expect(tokens).toContain("maleri");
    expect(tokens).toContain("ostersundsmaleri"); // domän-etikett
    expect(tokens).not.toContain("ab"); // generiskt bolagsord filtreras
  });

  it("hoppar över för korta tokens", () => {
    expect(brandTokens("AB Co", null)).toEqual([]);
  });
});

describe("isBranded", () => {
  const tokens = brandTokens(
    "Östersunds Måleri AB",
    "https://ostersundsmaleri.se",
  );

  it("matchar varumärkessökning accent-okänsligt", () => {
    expect(isBranded("östersunds måleri", tokens)).toBe(true);
    expect(isBranded("ostersundsmaleri ab", tokens)).toBe(true);
  });

  it("klassar generisk tjänstesökning som non-branded", () => {
    expect(isBranded("måla om huset pris", tokens)).toBe(false);
    // Ortnamnet "östersund" (utan s) matchar inte brand-token "ostersunds".
    expect(isBranded("fasadmålning östersund", tokens)).toBe(false);
  });

  it("utan tokens är inget branded", () => {
    expect(isBranded("vad som helst", [])).toBe(false);
  });

  it("klassar INTE branschord i företagsnamnet som varumärke (ordgräns)", () => {
    const buildTokens = brandTokens(
      "Jönköpings Bygg AB",
      "https://jonkopingsbygg.se",
    );
    // "bygg" (kort token) får bara matcha som helt ord, inte inuti "byggmaterial".
    expect(isBranded("köpa byggmaterial billigt", buildTokens)).toBe(false);
    // Men en faktisk varumärkessökning fångas via domän-etiketten.
    expect(isBranded("jonkopingsbygg", buildTokens)).toBe(true);
  });
});

describe("classifyBrandedQueries", () => {
  it("summerar klick/visningar per hink", () => {
    const tokens = brandTokens("Axona Digital", "https://axona.se");
    const split = classifyBrandedQueries(
      [
        { query: "axona digital", clicks: 10, impressions: 100 },
        { query: "axona", clicks: 5, impressions: 50 },
        { query: "webbyrå östersund", clicks: 8, impressions: 200 },
      ],
      tokens,
    );
    expect(split.branded.clicks).toBe(15);
    expect(split.branded.queries).toBe(2);
    expect(split.non_branded.clicks).toBe(8);
    expect(split.non_branded.queries).toBe(1);
    expect(split.non_branded.impressions).toBe(200);
  });
});
