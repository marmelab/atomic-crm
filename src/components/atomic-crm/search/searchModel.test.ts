import { describe, expect, it } from "vitest";

import {
  getSearchResultUrl,
  getSearchTerms,
  getSnippet,
  highlight,
  matchesAllTerms,
} from "./searchModel";

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

  it("folds letters that have no accent to strip, like the database does", () => {
    expect(matchedText("Łódź, Straße, Œuvre", "lodz strasse oeu")).toEqual([
      "Łódź",
      "Straße",
      "Œu",
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

describe("matchesAllTerms", () => {
  it("requires every term to start a word, folding letters like the database", () => {
    expect(
      matchesAllTerms("Søren Kierkegaard", getSearchTerms("soren kier")),
    ).toBe(true);
    expect(
      matchesAllTerms("Søren Kierkegaard", getSearchTerms("soren ren")),
    ).toBe(false);
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

  it("does not end an excerpt on the separator between two fields", () => {
    // the 60-character window after "Web" ends inside the long last field,
    // so the cut falls back to the space right after the " · "
    const content = `Web-enabled · Voluptate in nihil dolor sit amet. · ${"x".repeat(80)}`;

    const snippet = getSnippet("Rachel", content, getSearchTerms("web"));

    expect(snippet).toBe("Web-enabled · Voluptate in nihil dolor sit amet.…");
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

describe("getSearchResultUrl", () => {
  it("links a company to its show page", () => {
    expect(
      getSearchResultUrl(
        {
          resource: "companies",
          record_id: 7,
          contact_id: null,
          deal_id: null,
        },
        false,
      ),
    ).toBe("/companies/7/show");
  });

  it("links a contact to its show page", () => {
    expect(
      getSearchResultUrl(
        {
          resource: "contacts",
          record_id: 3,
          contact_id: 3,
          deal_id: null,
        },
        false,
      ),
    ).toBe("/contacts/3/show");
  });

  it("links a deal to its show page on desktop", () => {
    expect(
      getSearchResultUrl(
        {
          resource: "deals",
          record_id: 5,
          contact_id: null,
          deal_id: 5,
        },
        false,
      ),
    ).toBe("/deals/5/show");
  });

  it("returns null for a deal on mobile, where no deal page exists", () => {
    expect(
      getSearchResultUrl(
        {
          resource: "deals",
          record_id: 5,
          contact_id: null,
          deal_id: 5,
        },
        true,
      ),
    ).toBeNull();
  });

  it("opens a contact on its details tab on mobile", () => {
    expect(
      getSearchResultUrl(
        {
          resource: "contacts",
          record_id: 3,
          contact_id: 3,
          deal_id: null,
        },
        true,
      ),
    ).toBe("/contacts/3/show?tab=details");
  });

  it("links a task to the contact it belongs to", () => {
    expect(
      getSearchResultUrl(
        {
          resource: "tasks",
          record_id: 11,
          contact_id: 4,
          deal_id: null,
        },
        false,
      ),
    ).toBe("/contacts/4/show");
  });

  it("opens a task's contact on its tasks tab on mobile", () => {
    expect(
      getSearchResultUrl(
        {
          resource: "tasks",
          record_id: 11,
          contact_id: 4,
          deal_id: null,
        },
        true,
      ),
    ).toBe("/contacts/4/show?tab=tasks");
  });

  it("links a contact note to the contact page on desktop", () => {
    expect(
      getSearchResultUrl(
        {
          resource: "contact_notes",
          record_id: 12,
          contact_id: 4,
          deal_id: null,
        },
        false,
      ),
    ).toBe("/contacts/4/show");
  });

  it("links a contact note to the note detail page on mobile", () => {
    expect(
      getSearchResultUrl(
        {
          resource: "contact_notes",
          record_id: 12,
          contact_id: 4,
          deal_id: null,
        },
        true,
      ),
    ).toBe("/contacts/4/notes/12");
  });

  it("links a deal note to its deal on desktop and nowhere on mobile", () => {
    expect(
      getSearchResultUrl(
        {
          resource: "deal_notes",
          record_id: 20,
          contact_id: null,
          deal_id: 9,
        },
        false,
      ),
    ).toBe("/deals/9/show");
    expect(
      getSearchResultUrl(
        {
          resource: "deal_notes",
          record_id: 20,
          contact_id: null,
          deal_id: 9,
        },
        true,
      ),
    ).toBeNull();
  });

  it("links records whose parent id is 0", () => {
    // FakeRest generators assign array-index ids, so 0 is a real record.
    expect(
      getSearchResultUrl(
        { resource: "tasks", record_id: 0, contact_id: 0, deal_id: null },
        false,
      ),
    ).toBe("/contacts/0/show");
    expect(
      getSearchResultUrl(
        {
          resource: "contact_notes",
          record_id: 0,
          contact_id: 0,
          deal_id: null,
        },
        true,
      ),
    ).toBe("/contacts/0/notes/0");
    expect(
      getSearchResultUrl(
        { resource: "deal_notes", record_id: 0, contact_id: null, deal_id: 0 },
        false,
      ),
    ).toBe("/deals/0/show");
  });

  it("returns null when the parent record of a note or task is missing", () => {
    expect(
      getSearchResultUrl(
        {
          resource: "tasks",
          record_id: 11,
          contact_id: null,
          deal_id: null,
        },
        false,
      ),
    ).toBeNull();
    expect(
      getSearchResultUrl(
        {
          resource: "contact_notes",
          record_id: 12,
          contact_id: null,
          deal_id: null,
        },
        false,
      ),
    ).toBeNull();
  });
});
