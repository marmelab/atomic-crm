import { describe, expect, it } from "vitest";

import { getSearchTerms, getSnippet, highlight } from "./searchHighlight";

const matchedText = (text: string, query: string) =>
  highlight(text, getSearchTerms(query))
    .filter((part) => part.isMatch)
    .map((part) => part.text);

describe("highlight", () => {
  it("marks the start of each word a query term begins", () => {
    expect(matchedText("Thomas Anderson", "tho and")).toEqual(["Tho", "And"]);
  });

  it("ignores accents and case on both sides", () => {
    expect(matchedText("Hélène Électricité", "HELENE elec")).toEqual([
      "Hélène",
      "Élec",
    ]);
  });

  it("does not mark a term found in the middle of a word", () => {
    expect(matchedText("Thomas", "homas")).toEqual([]);
  });

  it("keeps the whole text, in order, across the parts", () => {
    const parts = highlight("Call Thomas, then Anna", getSearchTerms("th an"));

    expect(parts.map((part) => part.text).join("")).toBe(
      "Call Thomas, then Anna",
    );
  });
});

describe("getSnippet", () => {
  const description =
    "A family bakery founded in 1952, known across the region for its sourdough bread and its weekly farmers market stall near the station, run by the third generation of the Martin family since the late nineties.";

  it("returns an excerpt around a term the title does not show", () => {
    const snippet = getSnippet(
      "Boulangerie Martin",
      description,
      getSearchTerms("sourdough"),
    );

    expect(snippet).toContain("sourdough bread");
    expect(snippet?.startsWith("…")).toBe(true);
    expect(snippet?.endsWith("…")).toBe(true);
  });

  it("returns null when the title already shows every term", () => {
    expect(
      getSnippet("Boulangerie Martin", description, getSearchTerms("boul mar")),
    ).toBeNull();
  });

  it("shows an excerpt when the title has the term past its visible start", () => {
    const note =
      "Met Thomas at the farmers market. He wants a weekly delivery of sourdough loaves for his café.";

    const snippet = getSnippet(note, note, getSearchTerms("sourdough"));

    expect(snippet).toContain("delivery of sourdough loaves");
  });

  it("looks only for the terms missing from the title", () => {
    const snippet = getSnippet(
      "Boulangerie Martin",
      description,
      getSearchTerms("martin farmers"),
    );

    expect(snippet).toContain("farmers market");
  });
});
