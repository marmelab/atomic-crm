import { describe, expect, it } from "vitest";

import { getSearchResultUrl } from "./getSearchResultUrl";

const buildResult = (overrides: Parameters<typeof getSearchResultUrl>[0]) =>
  overrides;

describe("getSearchResultUrl", () => {
  it("links a company to its show page", () => {
    const result = buildResult({
      resource: "companies",
      record_id: 7,
      contact_id: null,
      deal_id: null,
    });

    expect(getSearchResultUrl(result, false)).toBe("/companies/7/show");
  });

  it("links a contact to its show page", () => {
    const result = buildResult({
      resource: "contacts",
      record_id: 3,
      contact_id: 3,
      deal_id: null,
    });

    expect(getSearchResultUrl(result, false)).toBe("/contacts/3/show");
  });

  it("links a deal to its show page on desktop", () => {
    const result = buildResult({
      resource: "deals",
      record_id: 5,
      contact_id: null,
      deal_id: 5,
    });

    expect(getSearchResultUrl(result, false)).toBe("/deals/5/show");
  });

  it("returns null for a deal on mobile, where no deal page exists", () => {
    const result = buildResult({
      resource: "deals",
      record_id: 5,
      contact_id: null,
      deal_id: 5,
    });

    expect(getSearchResultUrl(result, true)).toBeNull();
  });

  it("links a task to the contact it belongs to", () => {
    const result = buildResult({
      resource: "tasks",
      record_id: 11,
      contact_id: 4,
      deal_id: null,
    });

    expect(getSearchResultUrl(result, false)).toBe("/contacts/4/show");
  });

  it("links a contact note to the contact page on desktop", () => {
    const result = buildResult({
      resource: "contact_notes",
      record_id: 12,
      contact_id: 4,
      deal_id: null,
    });

    expect(getSearchResultUrl(result, false)).toBe("/contacts/4/show");
  });

  it("links a contact note to the note detail page on mobile", () => {
    const result = buildResult({
      resource: "contact_notes",
      record_id: 12,
      contact_id: 4,
      deal_id: null,
    });

    expect(getSearchResultUrl(result, true)).toBe("/contacts/4/notes/12");
  });

  it("links a deal note to its deal on desktop and nowhere on mobile", () => {
    const result = buildResult({
      resource: "deal_notes",
      record_id: 20,
      contact_id: null,
      deal_id: 9,
    });

    expect(getSearchResultUrl(result, false)).toBe("/deals/9/show");
    expect(getSearchResultUrl(result, true)).toBeNull();
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
